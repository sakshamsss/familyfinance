from typing import List, Dict, Any
from pydantic import BaseModel, Field
from db.models import CachedStockData
from db.crud import get_stock_cap_category


class ScreenerFilterParams(BaseModel):
    market: str = Field(default="INDIA_NSE")
    cap_filter: str = Field(default="ALL", description="ALL | LARGE_AND_MID | LARGE_CAP | MID_CAP | SMALL_CAP")
    min_upside_pct: float = Field(default=18.0, ge=0.0, le=100.0)
    min_discount_52w_pct: float = Field(default=10.0, ge=0.0, le=80.0)
    max_discount_52w_pct: float = Field(default=42.0, ge=5.0, le=90.0)
    min_roe_pct: float = Field(default=13.0, ge=0.0, le=60.0)
    max_debt_to_equity: float = Field(default=0.8, ge=0.0, le=5.0)
    min_delivery_pct: float = Field(default=40.0, ge=0.0, le=100.0)
    min_rsi: float = Field(default=40.0, ge=10.0, le=90.0)
    max_rsi: float = Field(default=68.0, ge=20.0, le=95.0)
    min_analyst_count: int = Field(default=3, ge=1, le=50)
    sector_filter: str = Field(default="ALL")
    capital: float = Field(default=500000.0, gt=0.0)
    risk_pct: float = Field(default=1.0, gt=0.0, le=5.0)


def is_financial_sector(sector: str, industry: str = "") -> bool:
    s = (sector or "").strip().lower()
    ind = (industry or "").strip().lower()
    return (
        s in ["financial services", "banks", "financial", "finance"]
        or "bank" in ind
        or "nbfc" in ind
        or "financial" in ind
        or "insurance" in ind
    )


def compute_bargain_velocity_score(stock: CachedStockData, min_analyst_count: int = 3) -> Dict[str, Any]:
    """
    Computes the deterministic 6-Factor 'Bargain Velocity Score' (0-100) per PRD Section 3.3.
    """
    price = max(float(stock.current_price or 1.0), 0.01)
    high_52w = max(float(stock.high_52w or price), price)
    low_52w = min(float(stock.low_52w or price * 0.8), price)

    target_median = float(stock.target_median_price or 0.0)
    target_mean = float(stock.target_mean_price or 0.0)
    consensus_target = target_median if target_median > 0 else target_mean
    if consensus_target <= 0:
        consensus_target = price * 1.15

    target_high = float(stock.target_high_price or consensus_target * 1.15)
    target_low = float(stock.target_low_price or consensus_target * 0.85)
    analyst_count = int(stock.analyst_count or 0)

    # --------------------------------------------------------------------------
    # Factor 1: Validated Consensus Analyst Upside (25 Points Max)
    # --------------------------------------------------------------------------
    upside_pct = ((consensus_target - price) / price) * 100.0
    dispersion_ratio = ((target_high - target_low) / consensus_target) if consensus_target > 0 else 0.0

    if upside_pct < 10.0:
        f1_raw = 0.0
    elif upside_pct >= 35.0:
        f1_raw = 25.0
    else:
        f1_raw = ((upside_pct - 10.0) / 25.0) * 25.0

    if dispersion_ratio > 0.50:
        f1_raw *= 0.50  # 50% penalty per PRD
    if analyst_count < min_analyst_count:
        f1_raw *= 0.40  # Low analyst count penalty

    factor1_upside_pts = round(max(0.0, min(25.0, f1_raw)), 1)

    # --------------------------------------------------------------------------
    # Factor 2: Bargain Valuation Discount (20 Points Max)
    # --------------------------------------------------------------------------
    discount_52w_pct = ((high_52w - price) / high_52w) * 100.0 if high_52w > 0 else 0.0
    if 12.0 <= discount_52w_pct <= 35.0:
        discount_pts = 12.0
    elif discount_52w_pct > 45.0:
        discount_pts = 4.0  # Structural crash penalty per PRD
    elif 35.0 < discount_52w_pct <= 45.0:
        discount_pts = 8.0
    elif 6.0 <= discount_52w_pct < 12.0:
        discount_pts = 7.0
    else:
        discount_pts = 3.0

    trailing_pe = float(stock.trailing_pe or 0.0)
    forward_pe = float(stock.forward_pe or 0.0)
    forward_earnings_expansion = (forward_pe > 0 and trailing_pe > 0 and forward_pe < trailing_pe)
    earnings_exp_pts = 8.0 if forward_earnings_expansion else (4.0 if (0 < forward_pe <= trailing_pe * 1.03) else 0.0)
    factor2_bargain_pts = round(min(20.0, discount_pts + earnings_exp_pts), 1)

    # --------------------------------------------------------------------------
    # Factor 3: Balance Sheet & Return Quality Shield (20 Points Max)
    # --------------------------------------------------------------------------
    fin_sector = is_financial_sector(stock.sector, stock.industry or "")
    roe_pct = float(stock.roe_pct or 0.0)
    roa_pct = float(stock.roa_pct or 0.0)
    de_ratio = float(stock.debt_to_equity if stock.debt_to_equity is not None else 0.0)

    if fin_sector:
        roe_pts = 10.0 if roe_pct >= 13.0 else (6.0 if roe_pct >= 10.5 else 0.0)
        roa_pts = 10.0 if roa_pct >= 1.1 else (6.0 if roa_pct >= 0.85 else 0.0)
        factor3_quality_pts = round(roe_pts + roa_pts, 1)
    else:
        roe_pts = 10.0 if roe_pct >= 15.0 else (6.0 if roe_pct >= 12.0 else 0.0)
        de_pts = 10.0 if de_ratio <= 0.5 else (6.0 if de_ratio <= 1.0 else 0.0)
        factor3_quality_pts = round(roe_pts + de_pts, 1)

    # --------------------------------------------------------------------------
    # Factor 4: Institutional Delivery & Volume Accumulation (15 Points Max)
    # --------------------------------------------------------------------------
    delivery_pct = float(stock.delivery_pct or 0.0)
    vol_surge = float(stock.volume_surge_ratio or 1.0)

    if delivery_pct >= 45.0 and vol_surge >= 1.25:
        factor4_inst_pts = 15.0
    elif delivery_pct >= 45.0 and vol_surge >= 1.05:
        factor4_inst_pts = 11.5
    elif delivery_pct >= 38.0 and vol_surge >= 1.25:
        factor4_inst_pts = 11.0
    elif delivery_pct >= 40.0 or vol_surge >= 1.15:
        factor4_inst_pts = 8.0
    else:
        factor4_inst_pts = 4.0

    # --------------------------------------------------------------------------
    # Factor 5: Technical Inflection & Anti-Falling-Knife Timing (10 Points Max)
    # --------------------------------------------------------------------------
    ema_20 = float(stock.ema_20 or price)
    ema_50 = float(stock.ema_50 or price)
    ema_200 = float(stock.ema_200 or price)
    rsi_14 = float(stock.rsi_14 or 50.0)

    if rsi_14 < 32.0 or rsi_14 > 74.0:
        factor5_timing_pts = 0.0
    elif price >= ema_20 * 0.98 and ema_50 >= ema_200 * 0.97 and (42.0 <= rsi_14 <= 64.0):
        factor5_timing_pts = 10.0
    elif price >= ema_20 * 0.96 and (38.0 <= rsi_14 <= 68.0):
        factor5_timing_pts = 6.5
    else:
        factor5_timing_pts = 3.5

    # --------------------------------------------------------------------------
    # Factor 6: Relative Strength & Volatility Contraction (10 Points Max)
    # --------------------------------------------------------------------------
    rs_20d = float(stock.rs_20d or 0.0)
    vcp_ratio = float(stock.vcp_tightness_ratio or 1.0)

    if rs_20d > 0.0 and vcp_ratio < 1.0:
        factor6_rs_vcp_pts = 10.0
    elif rs_20d > 0.0 or vcp_ratio < 1.0:
        factor6_rs_vcp_pts = 6.0
    else:
        factor6_rs_vcp_pts = 2.0

    total_score = round(
        min(
            100.0,
            factor1_upside_pts
            + factor2_bargain_pts
            + factor3_quality_pts
            + factor4_inst_pts
            + factor5_timing_pts
            + factor6_rs_vcp_pts,
        ),
        1,
    )

    return {
        "total_score": total_score,
        "factor1_upside_pts": factor1_upside_pts,
        "factor2_bargain_pts": factor2_bargain_pts,
        "factor3_quality_pts": factor3_quality_pts,
        "factor4_inst_pts": factor4_inst_pts,
        "factor5_timing_pts": factor5_timing_pts,
        "factor6_rs_vcp_pts": factor6_rs_vcp_pts,
        "upside_pct": round(upside_pct, 2),
        "discount_52w_pct": round(discount_52w_pct, 2),
        "dispersion_ratio": round(dispersion_ratio, 3),
        "consensus_target": round(consensus_target, 2),
        "forward_earnings_expansion": forward_earnings_expansion,
        "is_financial": fin_sector,
    }


def _format_cap_label(cap_category: str) -> str:
    if cap_category == "LARGE_CAP":
        return "Large-Cap"
    if cap_category == "MID_CAP":
        return "Mid-Cap"
    return "Small-Cap"


def run_inverted_funnel_screener(
    universe: List[CachedStockData],
    params: ScreenerFilterParams,
) -> Dict[str, Any]:
    """
    Executes the 4-Stage Inverted Funnel Screener in-memory on cached stock rows (<15ms).
    Returns stage-by-stage counts + market cap tier counts + ranked candidate list.
    """
    # Compute Market Cap Tier counts across the full market universe
    large_cnt = 0
    mid_cnt = 0
    small_cnt = 0
    for s in universe:
        cat = get_stock_cap_category(s.ticker, float(s.market_cap_cr or 0.0))
        if cat == "LARGE_CAP":
            large_cnt += 1
        elif cat == "MID_CAP":
            mid_cnt += 1
        else:
            small_cnt += 1

    cap_counts = {
        "ALL": len(universe),
        "LARGE_AND_MID": large_cnt + mid_cnt,
        "LARGE_CAP": large_cnt,
        "MID_CAP": mid_cnt,
        "SMALL_CAP": small_cnt,
    }

    cap_filter_upper = (params.cap_filter or "ALL").upper().strip()

    def _matches_cap(stock: CachedStockData) -> bool:
        if cap_filter_upper in ("ALL", ""):
            return True
        cat = get_stock_cap_category(stock.ticker, float(stock.market_cap_cr or 0.0))
        if cap_filter_upper == "LARGE_AND_MID":
            return cat in ("LARGE_CAP", "MID_CAP")
        return cat == cap_filter_upper

    filtered_universe = [
        s for s in universe
        if _matches_cap(s)
        and (params.sector_filter in ("ALL", "", None) or s.sector.lower() == params.sector_filter.lower())
    ]
    universe_count = len(filtered_universe)

    stage1_candidates = []
    stage2_candidates = []
    stage3_candidates = []

    for stock in filtered_universe:
        score_info = compute_bargain_velocity_score(stock, min_analyst_count=params.min_analyst_count)
        upside_pct = score_info["upside_pct"]
        discount_52w_pct = score_info["discount_52w_pct"]
        fin_sector = score_info["is_financial"]

        # Stage 1: Consensus Analyst Upside & 52W Bargain Discount Gate
        if (
            upside_pct >= params.min_upside_pct
            and params.min_discount_52w_pct <= discount_52w_pct <= params.max_discount_52w_pct
            and int(stock.analyst_count or 0) >= params.min_analyst_count
        ):
            stage1_candidates.append((stock, score_info))
        else:
            continue

        # Stage 2: Sector-Aware Balance Sheet & Return Quality Shield
        if fin_sector:
            eff_min_roe = min(params.min_roe_pct, 13.0)
            passes_quality = (float(stock.roe_pct or 0.0) >= eff_min_roe) and (float(stock.roa_pct or 0.0) >= 1.1)
        else:
            de_val = float(stock.debt_to_equity if stock.debt_to_equity is not None else 0.0)
            passes_quality = (float(stock.roe_pct or 0.0) >= params.min_roe_pct) and (de_val <= params.max_debt_to_equity)

        if passes_quality:
            stage2_candidates.append((stock, score_info))
        else:
            continue

        # Stage 3: Institutional Delivery & Anti-Falling-Knife Timing Gate
        rsi_val = float(stock.rsi_14 or 50.0)
        deliv_val = float(stock.delivery_pct or 0.0)
        price_val = float(stock.current_price or 1.0)
        ema20_val = float(stock.ema_20 or price_val)

        if (
            deliv_val >= params.min_delivery_pct
            and params.min_rsi <= rsi_val <= params.max_rsi
            and rsi_val >= 32.0
            and price_val >= ema20_val * 0.95
        ):
            stage3_candidates.append((stock, score_info))

    # Sort Stage 3 passes by total Bargain Velocity Score descending
    stage3_candidates.sort(key=lambda item: (item[1]["total_score"], item[1]["upside_pct"]), reverse=True)

    results = []
    for stock, sc in stage3_candidates:
        days_earn = stock.days_until_earnings
        earnings_warning = bool(days_earn is not None and 0 <= days_earn <= 7)
        cap_cat = get_stock_cap_category(stock.ticker, float(stock.market_cap_cr or 0.0))
        results.append({
            "ticker": stock.ticker,
            "company_name": stock.company_name,
            "market": stock.market,
            "sector": stock.sector,
            "industry": stock.industry,
            "cap_category": cap_cat,
            "cap_label": _format_cap_label(cap_cat),
            "market_cap_cr": round(float(stock.market_cap_cr or 0.0), 0),
            "current_price": round(float(stock.current_price), 2),
            "day_change_pct": round(float(stock.day_change_pct or 0.0), 2),
            "high_52w": round(float(stock.high_52w), 2),
            "low_52w": round(float(stock.low_52w), 2),
            "discount_52w_pct": sc["discount_52w_pct"],
            "consensus_target": sc["consensus_target"],
            "target_high": round(float(stock.target_high_price or sc["consensus_target"] * 1.15), 2),
            "target_low": round(float(stock.target_low_price or sc["consensus_target"] * 0.85), 2),
            "upside_pct": sc["upside_pct"],
            "analyst_count": int(stock.analyst_count or 0),
            "trailing_pe": round(float(stock.trailing_pe or 0.0), 1),
            "forward_pe": round(float(stock.forward_pe or 0.0), 1),
            "roe_pct": round(float(stock.roe_pct or 0.0), 1),
            "roa_pct": round(float(stock.roa_pct or 0.0), 2),
            "debt_to_equity": round(float(stock.debt_to_equity or 0.0), 2),
            "delivery_pct": round(float(stock.delivery_pct or 0.0), 1),
            "volume_surge_ratio": round(float(stock.volume_surge_ratio or 1.0), 2),
            "rsi_14": round(float(stock.rsi_14 or 50.0), 1),
            "ema_20": round(float(stock.ema_20 or stock.current_price), 2),
            "ema_50": round(float(stock.ema_50 or stock.current_price), 2),
            "ema_200": round(float(stock.ema_200 or stock.current_price), 2),
            "rs_20d": round(float(stock.rs_20d or 0.0), 2),
            "vcp_tightness_ratio": round(float(stock.vcp_tightness_ratio or 0.85), 2),
            "days_until_earnings": days_earn,
            "earnings_warning": earnings_warning,
            "bargain_score": sc["total_score"],
            "score_breakdown": sc,
            "data_source": stock.data_source,
            "updated_at": stock.updated_at.isoformat() if stock.updated_at else None,
        })

    return {
        "market": params.market,
        "cap_counts": cap_counts,
        "funnel_counts": {
            "universe_count": universe_count,
            "stage1_bargain_count": len(stage1_candidates),
            "stage2_quality_count": len(stage2_candidates),
            "stage3_timing_count": len(stage3_candidates),
        },
        "applied_filters": params.model_dump(),
        "candidates": results,
    }
