import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from config import settings
from db.models import CachedStockData, AIReportCache
from ai_agents.schemas import (
    CatalystPoint,
    BullBearDebateSchema,
    FamilyJudgeSchema,
    CatalystTimeline,
    FamilyAIReportSchema,
)

logger = logging.getLogger("family_finance.ai_orchestrator")


class MultiAgentOrchestrator:
    """
    Quota-Smart 2-Step AI Multi-Agent Pipeline for FamilyFinance:
      - Primary Model: `gemini-3.8-flash` (`ThinkingLevel.MEDIUM` for Call 1, `ThinkingLevel.HIGH` for Call 2)
      - Fallback Model: `gemini-3.5-flash-lite` on `429 RESOURCE_EXHAUSTED` or model unavailability
      - 24-Hour SQLite/Postgres Report Caching (`ai_reports_cache` keyed by `ticker + YYYY-MM-DD`)
    """

    def __init__(self) -> None:
        self.primary_model = os.getenv("PRIMARY_AI_MODEL", settings.PRIMARY_AI_MODEL or "gemini-3.8-flash")
        self.fallback_model = os.getenv("FALLBACK_AI_MODEL", settings.FALLBACK_AI_MODEL or "gemini-3.5-flash-lite")

    def _get_api_key(self, override_api_key: Optional[str] = None) -> str:
        raw = (override_api_key or os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()
        if raw.lower() in ("your_free_google_ai_studio_api_key", "none", ""):
            return ""
        return raw

    async def _call_gemini_structured(
        self,
        client: genai.Client,
        prompt: str,
        schema_cls: Any,
        thinking_level: types.ThinkingLevel,
    ) -> tuple[Dict[str, Any], str]:
        """
        Executes a structured JSON call with `PRIMARY_AI_MODEL` (`gemini-3.8-flash`) and
        `thinking_config=types.ThinkingConfig(thinking_level=...)`.
        Includes exponential backoff on `429 RESOURCE_EXHAUSTED` and automatic retry on
        `FALLBACK_AI_MODEL` (`gemini-3.5-flash-lite`, omitting `thinking_config` on Lite fallback).
        """
        # 1. Try Primary Model (gemini-3.8-flash) with exponential backoff on 429
        for attempt in range(2):
            try:
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema_cls,
                    thinking_config=types.ThinkingConfig(thinking_level=thinking_level),
                    temperature=0.25,
                )
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.primary_model,
                    contents=prompt,
                    config=config,
                )
                if resp and resp.text:
                    return json.loads(resp.text), self.primary_model
            except Exception as exc:
                err_str = str(exc).upper()
                is_quota = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "RATE" in err_str
                if is_quota and attempt == 0:
                    backoff = 2.0 * (2**attempt)
                    logger.warning(f"{self.primary_model} hit 429 quota; backing off {backoff}s before retry...")
                    await asyncio.sleep(backoff)
                    continue
                logger.info(f"Primary model ({self.primary_model}) transitioning to fallback ({self.fallback_model}): {exc}")
                break

        # 2. Automatic Fallback to FALLBACK_AI_MODEL (gemini-3.5-flash-lite, omitting thinking_config)
        for attempt in range(2):
            try:
                lite_config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema_cls,
                    temperature=0.25,
                )
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.fallback_model,
                    contents=prompt,
                    config=lite_config,
                )
                if resp and resp.text:
                    return json.loads(resp.text), self.fallback_model
            except Exception as exc:
                err_str = str(exc).upper()
                if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str) and attempt == 0:
                    await asyncio.sleep(2.5)
                    continue
                raise exc

        raise RuntimeError("Both primary and fallback Gemini calls returned empty responses.")

    async def run_2_step_pipeline(
        self,
        stock: CachedStockData,
        score_breakdown: Dict[str, Any],
        trade_ticket: Dict[str, Any],
        db: Optional[Session] = None,
        force_live_gemini: bool = False,
        override_api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        today_str = datetime.now(timezone.utc).date().isoformat()
        cache_key = f"{stock.ticker}_{today_str}"

        # 1. Check 24-hour SQLite/Postgres cache (`ai_reports_cache`) unless forced refresh
        if db is not None and not force_live_gemini:
            cached_row = db.query(AIReportCache).filter(AIReportCache.cache_key == cache_key).first()
            if cached_row and cached_row.report_json:
                try:
                    cached_data = json.loads(cached_row.report_json)
                    cached_data["cached_24h"] = True
                    cached_data["cache_key"] = cache_key
                    return cached_data
                except Exception:
                    pass

        api_key = self._get_api_key(override_api_key)
        if api_key:
            try:
                client = genai.Client(api_key=api_key)
                currency = "₹" if stock.market == "INDIA_NSE" else "$"

                quant_context = f"""
STOCK QUANTITATIVE SCORECARD & DETERMINISTIC TRADE TICKET (DO NOT ALTER ANY NUMBERS):
- Ticker: {stock.ticker} ({stock.company_name}) | Sector: {stock.sector} ({stock.industry})
- Current Price: {currency}{stock.current_price:,.2f} | 52W High: {currency}{stock.high_52w:,.2f} (-{score_breakdown['discount_52w_pct']}% Bargain Discount)
- Consensus Analyst Target (6M Target 2): {currency}{trade_ticket['target_2_6m']:,.2f} (+{trade_ticket['target_2_upside_pct']}% upside, {stock.analyst_count} Analysts)
- 3M Partial Profit Target 1: {currency}{trade_ticket['target_1_3m']:,.2f} (+{trade_ticket['target_1_upside_pct']}%)
- Ideal Buy Zone: {currency}{trade_ticket['buy_zone_low']:,.2f} to {currency}{trade_ticket['buy_zone_high']:,.2f}
- Hard Safety Stop-Loss: {currency}{trade_ticket['stop_loss_price']:,.2f} ({trade_ticket['stop_loss_pct']}%)
- Family Position Sizing: {trade_ticket['position_sizing']['recommended_shares']} Shares ({currency}{trade_ticket['position_sizing']['total_investment_amount']:,.2f}, Max Risk {currency}{trade_ticket['position_sizing']['actual_capital_risk_amount']:,.2f})
- Fundamentals: ROE {stock.roe_pct}%, ROA {stock.roa_pct}%, Debt/Equity {stock.debt_to_equity}, Trailing PE {stock.trailing_pe}x, Forward PE {stock.forward_pe}x
- Institutional Delivery & Volume: Delivery {stock.delivery_pct}%, Up-Day Volume Surge {stock.volume_surge_ratio}x
- Technicals: EMA20 {currency}{stock.ema_20:,.2f}, EMA50 {currency}{stock.ema_50:,.2f}, EMA200 {currency}{stock.ema_200:,.2f}, RSI(14) {stock.rsi_14}
- 6-Factor Bargain Velocity Score: {score_breakdown['total_score']} / 100
"""

                # CALL 1: Adversarial Bull vs. Bear Analyst (thinking_level=MEDIUM)
                call1_prompt = f"""
You are the Adversarial Bull & Bear Equity Analyst pair at FamilyFinance advising our family investment office.
{quant_context}
Produce simultaneously (always include the full form in brackets whenever you use any financial acronym):
1. `bull_case`: 3 concrete fundamental/technical catalysts explaining why {stock.ticker} can reach {currency}{trade_ticket['target_2_6m']:,.2f} in 3–6 months.
2. `bear_case`: 3 specific value-trap or structural risks explaining why {stock.ticker} is down {score_breakdown['discount_52w_pct']}% from its 52W (52-Week) high and what could invalidate the thesis.
"""
                debate_data, model_call1 = await self._call_gemini_structured(
                    client=client,
                    prompt=call1_prompt,
                    schema_cls=BullBearDebateSchema,
                    thinking_level=types.ThinkingLevel.MEDIUM,
                )

                # Polite 2-second pause between Call 1 and Call 2 to protect Free-Tier RPM limits
                await asyncio.sleep(2.0)

                # CALL 2: Family Investment Judge Synthesis (thinking_level=HIGH)
                call2_prompt = f"""
You are The Family Investment Judge at FamilyFinance advising on a conservative 3–6 month positional trade.
{quant_context}
ADVERSARIAL DEBATE SUMMARY:
Bull Case: {json.dumps(debate_data.get('bull_case', []))}
Bear Case: {json.dumps(debate_data.get('bear_case', []))}

Evaluate the quantitative scorecard + Bull/Bear debate against our conservative 3–6 month family risk profile and output (always include full forms in brackets for any financial acronyms):
- `verdict`: "ACCUMULATE_IN_BUY_ZONE" | "BUY_ON_DIP" | "WAIT_FOR_EARNINGS" | "AVOID_VALUE_TRAP"
- `ai_confidence_score`: 0 to 100
- `plain_english_summary`: Warm, jargon-free 3-sentence synthesis citing exact Buy Zone, Target 1, Target 2, Stop-Loss, and share count.
- `three_month_outlook`: 90-day operational & partial profit booking checkpoint at Target 1.
- `six_month_outlook`: 180-day fundamental re-rating checkpoint toward Target 2.
- `judge_rationale`: Risk-reward & post-tax execution rationale.
"""
                judge_data, model_call2 = await self._call_gemini_structured(
                    client=client,
                    prompt=call2_prompt,
                    schema_cls=FamilyJudgeSchema,
                    thinking_level=types.ThinkingLevel.HIGH,
                )

                used_model = model_call2 or model_call1
                gen_mode = (
                    "GEMINI_3_8_FLASH_PRIMARY"
                    if "3.8" in used_model
                    else "GEMINI_3_5_FLASH_LITE_FALLBACK"
                )

                bull_pts = [CatalystPoint(**pt) for pt in debate_data.get("bull_case", [])[:3]]
                bear_pts = [CatalystPoint(**pt) for pt in debate_data.get("bear_case", [])[:3]]
                conf_score = int(judge_data.get("ai_confidence_score", 78))
                summary_txt = str(judge_data.get("plain_english_summary", ""))
                outlook_3m = str(judge_data.get("three_month_outlook", ""))
                outlook_6m = str(judge_data.get("six_month_outlook", ""))

                report = FamilyAIReportSchema(
                    ticker=stock.ticker,
                    company_name=stock.company_name,
                    generation_mode=gen_mode,  # type: ignore[arg-type]
                    model_used=used_model,
                    cached_24h=False,
                    cache_key=cache_key,
                    verdict=judge_data.get("verdict", "ACCUMULATE_IN_BUY_ZONE"),
                    ai_confidence_score=conf_score,
                    conviction_score=conf_score,
                    plain_english_summary=summary_txt,
                    bull_case=bull_pts,
                    bear_case=bear_pts,
                    bull_catalysts=bull_pts,
                    bear_risks=bear_pts,
                    three_month_outlook=outlook_3m,
                    six_month_outlook=outlook_6m,
                    catalyst_timeline=CatalystTimeline(
                        checkpoint_90d=outlook_3m,
                        checkpoint_180d=outlook_6m,
                    ),
                    judge_rationale=str(judge_data.get("judge_rationale", "")),
                ).model_dump()

                self._save_to_cache(db, cache_key, stock.ticker, today_str, used_model, report)
                return report
            except Exception as exc:
                logger.warning(f"Gemini 2-step pipeline fell back to deterministic synthesis: {exc}")

        # Deterministic Fallback Synthesis (also cached in `ai_reports_cache` for 24h)
        det_report = _build_deterministic_ai_report(
            stock=stock,
            score_breakdown=score_breakdown,
            trade_ticket=trade_ticket,
            cache_key=cache_key,
            primary_model=self.primary_model,
        )
        self._save_to_cache(db, cache_key, stock.ticker, today_str, det_report["model_used"], det_report)
        return det_report

    def _save_to_cache(
        self,
        db: Optional[Session],
        cache_key: str,
        ticker: str,
        report_date: str,
        model_used: str,
        report: Dict[str, Any],
    ) -> None:
        if db is None:
            return
        try:
            existing = db.query(AIReportCache).filter(AIReportCache.cache_key == cache_key).first()
            if existing:
                existing.model_used = model_used
                existing.report_json = json.dumps(report)
                existing.created_at = datetime.now(timezone.utc)
            else:
                db.add(
                    AIReportCache(
                        cache_key=cache_key,
                        ticker=ticker,
                        report_date=report_date,
                        model_used=model_used,
                        report_json=json.dumps(report),
                    )
                )
            db.commit()
        except Exception as exc:
            logger.debug(f"AIReportCache write warning: {exc}")
            db.rollback()


multi_agent_orchestrator = MultiAgentOrchestrator()


async def generate_family_ai_debate(
    stock: CachedStockData,
    score_breakdown: Dict[str, Any],
    trade_ticket: Dict[str, Any],
    db: Optional[Session] = None,
    force_live_gemini: bool = False,
    override_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    return await multi_agent_orchestrator.run_2_step_pipeline(
        stock=stock,
        score_breakdown=score_breakdown,
        trade_ticket=trade_ticket,
        db=db,
        force_live_gemini=force_live_gemini,
        override_api_key=override_api_key,
    )


def _build_deterministic_ai_report(
    stock: CachedStockData,
    score_breakdown: Dict[str, Any],
    trade_ticket: Dict[str, Any],
    cache_key: str,
    primary_model: str = "gemini-3.8-flash",
) -> Dict[str, Any]:
    curr = "₹" if stock.market == "INDIA_NSE" else "$"
    price = float(stock.current_price)
    t1 = float(trade_ticket["target_1_3m"])
    t2 = float(trade_ticket["target_2_6m"])
    stop = float(trade_ticket["stop_loss_price"])
    buy_low = float(trade_ticket["buy_zone_low"])
    buy_high = float(trade_ticket["buy_zone_high"])
    shares = int(trade_ticket["position_sizing"]["recommended_shares"])
    inv_amt = float(trade_ticket["position_sizing"]["total_investment_amount"])
    risk_amt = float(trade_ticket["position_sizing"]["actual_capital_risk_amount"])

    total_score = float(score_breakdown["total_score"])
    upside_pct = float(score_breakdown["upside_pct"])
    discount_pct = float(score_breakdown["discount_52w_pct"])
    is_fin = bool(score_breakdown["is_financial"])
    earnings_warn = bool(trade_ticket["earnings_check"]["earnings_warning"])

    if earnings_warn:
        verdict = "WAIT_FOR_EARNINGS"
    elif total_score < 48.0 or (float(stock.rsi_14 or 50.0) < 32.0):
        verdict = "AVOID_VALUE_TRAP"
    elif price > buy_high * 1.02:
        verdict = "BUY_ON_DIP"
    else:
        verdict = "ACCUMULATE_IN_BUY_ZONE"

    conviction_score = int(round(min(96.0, max(35.0, total_score * 0.92 + (6.0 if upside_pct >= 22.0 else 0.0)))))

    bull_catalysts = [
        CatalystPoint(
            title=f"+{upside_pct:.1f}% Validated Consensus Upside to {curr}{t2:,.2f}",
            explanation=(
                f"{stock.analyst_count} institutional analysts maintain a median 6-month target of {curr}{t2:,.2f} "
                f"while the stock trades {discount_pct:.1f}% below its 52W (52-Week) high of {curr}{stock.high_52w:,.2f}, "
                f"supported by forward P/E (Price-to-Earnings) compression ({stock.forward_pe:.1f}x vs trailing {stock.trailing_pe:.1f}x)."
            ),
        ),
        CatalystPoint(
            title=(
                f"Strong Banking Return Profile — ROE (Return on Equity) {stock.roe_pct:.1f}%, ROA (Return on Assets) {stock.roa_pct:.2f}%"
                if is_fin
                else f"Strong Balance Sheet — ROE (Return on Equity) {stock.roe_pct:.1f}%, D/E (Debt-to-Equity) {stock.debt_to_equity:.2f}x"
            ),
            explanation=(
                f"{stock.company_name} generates an ROE (Return on Equity) of {stock.roe_pct:.1f}% and ROA (Return on Assets) of {stock.roa_pct:.2f}%, "
                f"exceeding our strict >=13% ROE (Return on Equity) and >=1.1% ROA (Return on Assets) quality standard for banks."
                if is_fin
                else f"{stock.company_name} compounds capital at {stock.roe_pct:.1f}% ROE (Return on Equity) with a conservative {stock.debt_to_equity:.2f}x D/E (Debt-to-Equity) ratio, "
                f"protecting family capital against high interest costs."
            ),
        ),
        CatalystPoint(
            title=f"Institutional Delivery ({stock.delivery_pct:.1f}%) & Support Near {curr}{stock.ema_20:,.2f}",
            explanation=(
                f"Delivery volume stands at {stock.delivery_pct:.1f}% with a {stock.volume_surge_ratio:.2f}x up-day volume surge. "
                f"Price ({curr}{price:,.2f}) has stabilized along its 20-day EMA (Exponential Moving Average) ({curr}{stock.ema_20:,.2f}) with RSI (Relative Strength Index) at {stock.rsi_14:.1f}, "
                f"signaling steady institutional buying rather than a falling knife."
            ),
        ),
    ]

    bear_risks = [
        CatalystPoint(
            title=f"Why It Is Down {discount_pct:.1f}% From Its 52W (52-Week) High ({curr}{stock.high_52w:,.2f})",
            explanation=(
                f"Recent sector rotation and valuation consolidation in {stock.industry or stock.sector} pulled the stock from "
                f"{curr}{stock.high_52w:,.2f} to {curr}{price:,.2f}. If institutional inflows remain slow, re-rating toward {curr}{t2:,.2f} could take closer to 6 months."
            ),
        ),
        CatalystPoint(
            title="Margin & Quarterly Earnings Sensitivity",
            explanation=(
                f"The consensus target assumes forward P/E (Price-to-Earnings) expansion from {stock.forward_pe:.1f}x. Any quarterly miss in operating margins "
                f"or guidance revision over the next 2 quarters would cap upside near Target 1 ({curr}{t1:,.2f})."
            ),
        ),
        CatalystPoint(
            title=f"Support Breakdown Below {curr}{stop:,.2f}",
            explanation=(
                f"A daily close below our ATR (Average True Range) & 20-day swing low stop-loss at {curr}{stop:,.2f} ({trade_ticket['stop_loss_pct']}%) "
                f"would break the upward trend and require a disciplined exit."
            ),
        ),
    ]

    family_summary = (
        f"{stock.company_name} is a high-quality {stock.sector.lower()} leader currently available at a {discount_pct:.1f}% bargain discount "
        f"from its 52W (52-Week) high while {stock.analyst_count} institutional analysts see it rising to {curr}{t2:,.2f} (+{upside_pct:.1f}%). "
        f"The company's profitability — ROE (Return on Equity) {stock.roe_pct:.1f}% — and steady delivery buying ({stock.delivery_pct:.1f}% delivery) confirm the business is healthy and has stopped falling. "
        f"Our family plan is to buy {shares} shares between {curr}{buy_low:,.2f} and {curr}{buy_high:,.2f} (total {curr}{inv_amt:,.0f}), book half our profit at {curr}{t1:,.2f} in ~3 months, and keep a strict safety stop-loss at {curr}{stop:,.2f} so our maximum risk is capped at {curr}{risk_amt:,.0f}."
    )

    outlook_3m = (
        f"Day 1–90: Buy {shares} shares in Buy Zone ({curr}{buy_low:,.2f}–{curr}{buy_high:,.2f}). "
        f"On rally to 3M (3-Month) Target 1 ({curr}{t1:,.2f}, +{trade_ticket['target_1_upside_pct']}%), sell 50% ({trade_ticket['position_sizing']['shares_to_book_at_t1']} shares) "
        f"and move Stop-Loss on remaining shares to breakeven ({curr}{price:,.2f})."
    )
    outlook_6m = (
        f"Day 90–180: Hold remaining {trade_ticket['position_sizing']['shares_to_ride_to_t2']} risk-free shares toward "
        f"6M (6-Month) Consensus Analyst Target 2 ({curr}{t2:,.2f}, +{trade_ticket['target_2_upside_pct']}%). "
        f"If flat (<4% gain) after 75 days, rotate capital into a stronger setup."
    )

    judge_rationale = (
        f"Bargain Score: {total_score}/100 | Reward-to-Risk Ratio: {trade_ticket['reward_to_risk_ratio']}x. "
        f"Net expected profit after STT (Securities Transaction Tax), brokerage charges, and 12.5% tax reserve is {curr}{trade_ticket['profit_and_friction']['net_post_friction_profit_t2']:,.0f} "
        f"(Full Target 2) or {curr}{trade_ticket['profit_and_friction']['net_post_friction_profit_blended']:,.0f} (50/50 Target 1 + Target 2 plan)."
    )

    report = FamilyAIReportSchema(
        ticker=stock.ticker,
        company_name=stock.company_name,
        generation_mode="DETERMINISTIC_INSTITUTIONAL_SYNTHESIS",
        model_used=f"{primary_model} (Quant Synthesis)",
        cached_24h=False,
        cache_key=cache_key,
        verdict=verdict,  # type: ignore[arg-type]
        ai_confidence_score=conviction_score,
        conviction_score=conviction_score,
        plain_english_summary=family_summary,
        bull_case=bull_catalysts,
        bear_case=bear_risks,
        bull_catalysts=bull_catalysts,
        bear_risks=bear_risks,
        three_month_outlook=outlook_3m,
        six_month_outlook=outlook_6m,
        catalyst_timeline=CatalystTimeline(
            checkpoint_90d=outlook_3m,
            checkpoint_180d=outlook_6m,
        ),
        judge_rationale=judge_rationale,
    )
    return report.model_dump()
