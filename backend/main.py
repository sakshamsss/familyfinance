import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Depends, HTTPException, Request, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings, INDIA_NSE_UNIVERSE, US_EQUITIES_UNIVERSE, PRIORITY_INDIA_QUOTE_SYNC, PRIORITY_US_QUOTE_SYNC
from auth import verify_family_pin, create_signed_session_token, is_request_authenticated
from db.database import engine, Base, get_db, SessionLocal
from db.models import CachedStockData, FamilyPosition, ScreenerPreset, AuditSignalLog, AIReportCache
from db.crud import (
    seed_initial_database,
    get_cached_universe,
    get_cached_stock,
    build_cached_stock_model,
    export_backup_json,
    import_backup_json,
)
from adapters.nse_mcp_client import nse_mcp_client, ensure_ns_suffix
from adapters.india_adapter import india_adapter, generate_synthetic_ohlcv
from adapters.us_adapter import us_adapter
from quant.regime_engine import evaluate_market_regime
from quant.funnel_screener import (
    ScreenerFilterParams,
    compute_bargain_velocity_score,
    run_inverted_funnel_screener,
)
from quant.trade_ticket import compute_actionable_trade_ticket
from quant.indicators import compute_ema
from quant.backtester import run_historical_backtest
from ai_agents.orchestrator import generate_family_ai_debate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("family_alpha.main")

# Global state for background cache refresh & cached regime
REFRESH_STATE: Dict[str, Any] = {
    "is_running": False,
    "market": "ALL",
    "processed": 0,
    "total": 0,
    "last_refreshed_at": datetime.now(timezone.utc).isoformat(),
    "last_source": "NSE_MCP+YFINANCE",
}

REGIME_CACHE: Dict[str, Dict[str, Any]] = {}
scheduler = AsyncIOScheduler()


async def sync_live_quotes_into_cache(market: str = "ALL") -> None:
    """
    Fast background overlay that pulls live batch quotes from Official NSE MCP (`get_bulk_quote`)
    and `yfinance` for US stocks, updating `CachedStockData` prices, 52W discounts, and technical anchors.
    """
    if REFRESH_STATE["is_running"]:
        return

    REFRESH_STATE["is_running"] = True
    try:
        db = SessionLocal()
        try:
            targets: List[tuple[str, List[str]]] = []
            if market in ("ALL", "INDIA_NSE"):
                targets.append(("INDIA_NSE", PRIORITY_INDIA_QUOTE_SYNC))
            if market in ("ALL", "US_NYSE"):
                targets.append(("US_NYSE", PRIORITY_US_QUOTE_SYNC))

            total_syms = sum(len(s) for _, s in targets)
            REFRESH_STATE["total"] = total_syms
            REFRESH_STATE["processed"] = 0
            REFRESH_STATE["market"] = market

            for mkt, sym_list in targets:
                if mkt == "INDIA_NSE":
                    quotes = await india_adapter.fetch_batch_quotes(sym_list)
                else:
                    quotes = await us_adapter.fetch_batch_quotes(sym_list)

                for sym in sym_list:
                    q = quotes.get(sym)
                    if q and float(q.get("current_price") or 0.0) > 0:
                        row = db.query(CachedStockData).filter(CachedStockData.ticker == sym).first()
                        if row:
                            old_price = float(row.current_price or q["current_price"])
                            new_price = float(q["current_price"])
                            ratio = new_price / old_price if old_price > 0 else 1.0

                            row.current_price = round(new_price, 2)
                            row.previous_close = round(float(q.get("previous_close") or new_price), 2)
                            row.day_change_pct = round(float(q.get("day_change_pct") or 0.0), 2)

                            # If price moved significantly vs seed, scale technical anchors, 52W range & target proportionally
                            if 0.35 <= ratio <= 3.0 and abs(ratio - 1.0) > 0.02:
                                if not q.get("high_52w"):
                                    row.high_52w = round(max(float(row.high_52w) * ratio, new_price * 1.05), 2)
                                if not q.get("low_52w"):
                                    row.low_52w = round(min(float(row.low_52w) * ratio, new_price * 0.92), 2)
                                row.ema_20 = round(float(row.ema_20) * ratio, 2)
                                row.ema_50 = round(float(row.ema_50) * ratio, 2)
                                row.ema_200 = round(float(row.ema_200) * ratio, 2)
                                row.swing_low_20d = round(float(row.swing_low_20d) * ratio, 2)
                                row.atr_14 = round(max(new_price * 0.015, float(row.atr_14) * ratio), 2)
                                row.target_median_price = round(float(row.target_median_price) * ratio, 2)
                                row.target_mean_price = round(float(row.target_mean_price) * ratio, 2)
                                row.target_high_price = round(float(row.target_high_price) * ratio, 2)
                                row.target_low_price = round(float(row.target_low_price) * ratio, 2)

                            if q.get("high_52w"):
                                row.high_52w = round(max(float(q["high_52w"]), new_price), 2)
                            if q.get("low_52w"):
                                row.low_52w = round(min(float(q["low_52w"]), new_price), 2)

                            row.data_source = str(q.get("source") or "NSE_MCP_LIVE")
                            row.updated_at = datetime.now(timezone.utc)
                    REFRESH_STATE["processed"] += 1
                db.commit()

            REFRESH_STATE["last_refreshed_at"] = datetime.now(timezone.utc).isoformat()
        finally:
            db.close()
    except Exception as exc:
        logger.warning(f"Background quote sync warning: {exc}")
    finally:
        REFRESH_STATE["is_running"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema and seed 150 India NSE + 40 US stocks
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_database(db)
        db.query(AIReportCache).delete()
        db.commit()
    finally:
        db.close()

    # Trigger non-blocking initial live quote sync from NSE MCP & yfinance
    asyncio.create_task(sync_live_quotes_into_cache("ALL"))

    # Schedule periodic refresh every 15 minutes
    scheduler.add_job(sync_live_quotes_into_cache, "interval", minutes=15, args=["ALL"], id="periodic_quote_sync", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="FamilyFinance — Stock Research, Trade Planner & Family Portfolio",
    version="1.0.0",
    description="Private Family Investment Platform (India NSE + US Equities)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def family_pin_middleware(request: Request, call_next):
    open_paths = ("/api/auth/verify-pin", "/api/health", "/health", "/docs", "/openapi.json")
    if request.method == "OPTIONS" or request.url.path in open_paths or not request.url.path.startswith("/api/"):
        return await call_next(request)

    if not is_request_authenticated(request):
        return JSONResponse(
            status_code=401,
            content={"detail": "Incorrect PIN"},
        )
    return await call_next(request)


# ==============================================================================
# Pydantic Request Models
# ==============================================================================
class PinVerifyRequest(BaseModel):
    pin: str

class PortfolioCreateRequest(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    market: str = "INDIA_NSE"
    sector: Optional[str] = "Industrials"
    owner: str = Field(default="Joint", description="Saksham | Family | Joint")
    status: str = Field(default="ACTIVE", description="ACTIVE | WATCHLIST | CLOSED")
    shares: int = Field(default=10, ge=1)
    entry_price: float = Field(gt=0)
    entry_date: Optional[str] = None
    stop_loss_price: Optional[float] = None
    target_1_price: Optional[float] = None
    target_2_price: Optional[float] = None
    partial_booked: bool = False
    notes: Optional[str] = ""


class PortfolioUpdateRequest(BaseModel):
    owner: Optional[str] = None
    status: Optional[str] = None
    shares: Optional[int] = None
    entry_price: Optional[float] = None
    entry_date: Optional[str] = None
    stop_loss_price: Optional[float] = None
    target_1_price: Optional[float] = None
    target_2_price: Optional[float] = None
    partial_booked: Optional[bool] = None
    notes: Optional[str] = None


class AIDebateTriggerRequest(BaseModel):
    capital: float = 500000.0
    risk_pct: float = 1.0
    market: str = "INDIA_NSE"
    gemini_api_key: Optional[str] = None


# ==============================================================================
# 0. FAMILY VAULT PIN AUTHENTICATION (`0410`)
# ==============================================================================
@app.post("/api/auth/verify-pin")
async def verify_pin_endpoint(req: PinVerifyRequest):
    if not verify_family_pin(req.pin):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    token = create_signed_session_token()
    return {
        "authenticated": True,
        "token": token,
    }


# ==============================================================================
# 1. SYSTEM HEALTH & PRESETS
# ==============================================================================
@app.get("/health")
@app.get("/api/health")
async def get_health(db: Session = Depends(get_db)):
    india_cnt = db.query(CachedStockData).filter(CachedStockData.market == "INDIA_NSE").count()
    us_cnt = db.query(CachedStockData).filter(CachedStockData.market == "US_NYSE").count()
    positions_cnt = db.query(FamilyPosition).count()
    cached_ai_cnt = db.query(AIReportCache).count()
    return {
        "status": "healthy",
        "app_name": "FamilyFinance",
        "primary_users": ["Saksham", "Family"],
        "cache_freshness": REFRESH_STATE["last_refreshed_at"],
        "refresh_in_progress": REFRESH_STATE["is_running"],
        "universe_counts": {
            "INDIA_NSE": india_cnt,
            "US_NYSE": us_cnt,
            "total": india_cnt + us_cnt,
        },
        "family_positions_count": positions_cnt,
        "cached_ai_reports_count": cached_ai_cnt,
        "adapters": {
            "nse_mcp_bhavcopy": settings.NSE_MCP_BHAVCOPY_URL,
            "nse_mcp_cm_market": settings.NSE_MCP_CM_MARKET_URL,
            "yfinance": "active",
            "gemini_ai_configured": bool(settings.GEMINI_API_KEY.strip() and settings.GEMINI_API_KEY != "your_free_google_ai_studio_api_key"),
            "primary_ai_model": settings.PRIMARY_AI_MODEL,
            "fallback_ai_model": settings.FALLBACK_AI_MODEL,
        },
    }


@app.get("/api/presets")
async def get_strategy_presets(db: Session = Depends(get_db)):
    presets = db.query(ScreenerPreset).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "badge": p.badge,
            "description": p.description,
            "min_upside_pct": p.min_upside_pct,
            "min_discount_52w_pct": p.min_discount_52w_pct,
            "max_discount_52w_pct": p.max_discount_52w_pct,
            "min_roe_pct": p.min_roe_pct,
            "max_debt_to_equity": p.max_debt_to_equity,
            "min_delivery_pct": p.min_delivery_pct,
            "min_rsi": p.min_rsi,
            "max_rsi": p.max_rsi,
            "min_analyst_count": p.min_analyst_count,
            "risk_per_trade_pct": p.risk_per_trade_pct,
        }
        for p in presets
    ]


# ==============================================================================
# 2. MARKET REGIME ENGINE
# ==============================================================================
@app.get("/api/regime")
async def get_market_regime(
    market: str = Query(default="INDIA_NSE", description="INDIA_NSE or US_NYSE"),
    force_refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    now_ts = datetime.now(timezone.utc).timestamp()
    cached = REGIME_CACHE.get(market)
    if cached and not force_refresh and (now_ts - cached.get("_ts", 0)) < 180:
        return {k: v for k, v in cached.items() if k != "_ts"}

    universe_rows = get_cached_universe(db, market=market)
    try:
        if market == "INDIA_NSE":
            b_data = await asyncio.wait_for(india_adapter.fetch_benchmark_regime_data(), timeout=6.0)
        else:
            b_data = await asyncio.wait_for(us_adapter.fetch_benchmark_regime_data(), timeout=6.0)
    except Exception:
        b_data = {}

    regime_info = evaluate_market_regime(market, benchmark_data=b_data, universe_rows=universe_rows)
    REGIME_CACHE[market] = {**regime_info, "_ts": now_ts}
    return regime_info


# ==============================================================================
# 3. 4-STAGE INVERTED FUNNEL SCREENER & CACHE SYNC
# ==============================================================================
@app.post("/api/screener/run")
async def run_screener(
    params: ScreenerFilterParams,
    db: Session = Depends(get_db),
):
    universe = get_cached_universe(db, market=params.market)
    if not universe:
        seed_initial_database(db)
        universe = get_cached_universe(db, market=params.market)

    result = run_inverted_funnel_screener(universe, params)
    # Include distinct sectors available in universe for UI sector filter pills
    sectors = sorted(list({s.sector for s in universe if s.sector}))
    result["available_sectors"] = ["ALL"] + sectors
    result["cache_timestamp"] = REFRESH_STATE["last_refreshed_at"]
    return result


@app.post("/api/cache/refresh")
async def trigger_cache_refresh(
    background_tasks: BackgroundTasks,
    market: str = Query(default="ALL"),
):
    if not REFRESH_STATE["is_running"]:
        background_tasks.add_task(sync_live_quotes_into_cache, market)
    return {
        "message": "Background universe sync triggered.",
        "state": REFRESH_STATE,
    }


@app.get("/api/cache/status")
async def get_cache_status():
    return REFRESH_STATE


# ==============================================================================
# 4. STOCK DEEP-DIVE, ACTIONABLE TRADE TICKET & AI MULTI-AGENT DEBATE
# ==============================================================================
@app.get("/api/stock/{ticker}")
async def get_stock_deep_dive(
    ticker: str,
    market: str = Query(default="INDIA_NSE"),
    capital: float = Query(default=500000.0, gt=0),
    risk_pct: float = Query(default=1.0, gt=0, le=5.0),
    force_live_ai: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    norm_ticker = ensure_ns_suffix(ticker) if market == "INDIA_NSE" else ticker.upper().strip()
    stock = get_cached_stock(db, norm_ticker, market=market)
    if not stock:
        stock = build_cached_stock_model(norm_ticker, market)
        db.add(stock)
        db.commit()
        db.refresh(stock)

    # Fetch live deep-dive bundle (NSE MCP + yfinance OHLCV & fundamentals) with fast timeout
    try:
        if market == "INDIA_NSE":
            live_bundle = await asyncio.wait_for(india_adapter.fetch_stock_deep_dive(norm_ticker, period="2y"), timeout=9.0)
        else:
            live_bundle = await asyncio.wait_for(us_adapter.fetch_stock_deep_dive(norm_ticker, period="2y"), timeout=9.0)
    except Exception as exc:
        logger.debug(f"Deep dive live fetch fallback for {norm_ticker}: {exc}")
        live_bundle = {}

    # Update cached stock fields if live_bundle returned fresh valid metrics
    if live_bundle:
        if float(live_bundle.get("current_price") or 0.0) > 0:
            old_p = float(stock.current_price or live_bundle["current_price"])
            new_p = float(live_bundle["current_price"])
            stock.current_price = round(new_p, 2)
            stock.previous_close = round(float(live_bundle.get("previous_close") or new_p), 2)
            stock.day_change_pct = round(float(live_bundle.get("day_change_pct") or 0.0), 2)
            stock.high_52w = max(round(float(live_bundle.get("high_52w") or stock.high_52w), 2), new_p)
            stock.low_52w = min(round(float(live_bundle.get("low_52w") or stock.low_52w), 2), new_p)

            # Update analyst targets if present and realistic
            t_med = float(live_bundle.get("target_median_price") or 0.0)
            if t_med > new_p * 0.8:
                stock.target_median_price = round(t_med, 2)
                stock.target_mean_price = round(float(live_bundle.get("target_mean_price") or t_med), 2)
                stock.target_high_price = round(float(live_bundle.get("target_high_price") or t_med * 1.15), 2)
                stock.target_low_price = round(float(live_bundle.get("target_low_price") or t_med * 0.85), 2)
            elif abs(new_p - old_p) / max(1.0, old_p) > 0.05:
                scale = new_p / max(1.0, old_p)
                stock.target_median_price = round(float(stock.target_median_price) * scale, 2)
                stock.target_mean_price = round(float(stock.target_mean_price) * scale, 2)
                stock.target_high_price = round(float(stock.target_high_price) * scale, 2)
                stock.target_low_price = round(float(stock.target_low_price) * scale, 2)

            if int(live_bundle.get("analyst_count") or 0) >= 3:
                stock.analyst_count = int(live_bundle["analyst_count"])
            if live_bundle.get("roe_pct") is not None and float(live_bundle["roe_pct"]) > 0:
                stock.roe_pct = float(live_bundle["roe_pct"])
            if live_bundle.get("roa_pct") is not None and float(live_bundle["roa_pct"]) > 0:
                stock.roa_pct = float(live_bundle["roa_pct"])
            if live_bundle.get("debt_to_equity") is not None and float(live_bundle["debt_to_equity"]) >= 0:
                stock.debt_to_equity = float(live_bundle["debt_to_equity"])
            if live_bundle.get("delivery_pct") is not None:
                stock.delivery_pct = float(live_bundle["delivery_pct"])
            if live_bundle.get("volume_surge_ratio") is not None:
                stock.volume_surge_ratio = float(live_bundle["volume_surge_ratio"])

            tech = live_bundle.get("technicals") or {}
            if tech.get("ema_20"):
                stock.ema_20 = float(tech["ema_20"])
                stock.ema_50 = float(tech["ema_50"])
                stock.ema_200 = float(tech["ema_200"])
                stock.rsi_14 = float(tech["rsi_14"])
                stock.atr_14 = float(tech["atr_14"])
                stock.swing_low_20d = float(tech["swing_low_20d"])
                stock.rs_20d = float(tech["rs_20d"])
                stock.vcp_tightness_ratio = float(tech["vcp_tightness_ratio"])

            stock.data_source = str(live_bundle.get("data_source") or "NSE_MCP+YFINANCE")
            stock.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(stock)

    # Prepare OHLCV history DataFrame for chart + backtester
    hist_df = live_bundle.get("history_df") if live_bundle else None
    if hist_df is None or hist_df.empty or len(hist_df) < 30:
        hist_df = generate_synthetic_ohlcv(
            current_price=float(stock.current_price),
            high_52w=float(stock.high_52w),
            low_52w=float(stock.low_52w),
            bars=380,
            seed_key=stock.ticker,
        )

    # Format last 180 trading days of OHLCV + EMA20/50/200 for the Interactive Price Chart
    chart_df = hist_df.copy().tail(180)
    chart_df["EMA20"] = compute_ema(chart_df["Close"], 20)
    chart_df["EMA50"] = compute_ema(chart_df["Close"], 50)
    chart_df["EMA200"] = compute_ema(chart_df["Close"], 200)

    ohlcv_series = []
    for idx, row in chart_df.iterrows():
        dt_str = str(idx)[:10]
        ohlcv_series.append({
            "time": dt_str,
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(float(row.get("Volume") or 0)),
            "ema20": round(float(row["EMA20"]), 2),
            "ema50": round(float(row["EMA50"]), 2),
            "ema200": round(float(row["EMA200"]), 2),
        })

    # Regime info for position sizing multiplier
    regime_data = REGIME_CACHE.get(market)
    if not regime_data:
        regime_data = evaluate_market_regime(market, universe_rows=get_cached_universe(db, market))
    regime_multiplier = float(regime_data.get("sizing_multiplier") or 1.0)
    regime_name = str(regime_data.get("regime") or "GREEN_BULL")

    # Compute 6-Factor Bargain Velocity Score
    score_breakdown = compute_bargain_velocity_score(stock)

    # Compute Deterministic 3-6M Trade Ticket
    trade_ticket = compute_actionable_trade_ticket(
        stock=stock,
        family_capital=capital,
        user_risk_pct=risk_pct,
        regime_multiplier=regime_multiplier,
        regime_name=regime_name,
    )

    # Compute 3-Year Historical Backtest Strip
    backtest_summary = run_historical_backtest(stock.ticker, hist_df, market=market)

    # Generate Multi-Agent AI Debate Report (with 24-Hour SQLite/Postgres cache)
    ai_report = await generate_family_ai_debate(
        stock=stock,
        score_breakdown=score_breakdown,
        trade_ticket=trade_ticket,
        db=db,
        force_live_gemini=force_live_ai,
    )

    # Record audit log entry
    try:
        log_entry = AuditSignalLog(
            ticker=stock.ticker,
            market=stock.market,
            signal_date=datetime.now(timezone.utc).date().isoformat(),
            bargain_score=score_breakdown["total_score"],
            verdict=ai_report["verdict"],
            entry_price=stock.current_price,
            target_1=trade_ticket["target_1_3m"],
            target_2=trade_ticket["target_2_6m"],
            stop_loss=trade_ticket["stop_loss_price"],
            ai_summary=ai_report["plain_english_summary"],
            raw_payload=json.dumps({"score": score_breakdown["total_score"], "verdict": ai_report["verdict"]}),
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()

    return {
        "ticker": stock.ticker,
        "company_name": stock.company_name,
        "market": stock.market,
        "sector": stock.sector,
        "industry": stock.industry,
        "currency_symbol": "₹" if stock.market == "INDIA_NSE" else "$",
        "current_price": round(float(stock.current_price), 2),
        "previous_close": round(float(stock.previous_close), 2),
        "day_change_pct": round(float(stock.day_change_pct), 2),
        "high_52w": round(float(stock.high_52w), 2),
        "low_52w": round(float(stock.low_52w), 2),
        "analyst_thermometer": {
            "low_52w": round(float(stock.low_52w), 2),
            "current_price": round(float(stock.current_price), 2),
            "high_52w": round(float(stock.high_52w), 2),
            "target_low": round(float(stock.target_low_price or score_breakdown["consensus_target"] * 0.85), 2),
            "target_median": score_breakdown["consensus_target"],
            "target_mean": round(float(stock.target_mean_price or score_breakdown["consensus_target"]), 2),
            "target_high": round(float(stock.target_high_price or score_breakdown["consensus_target"] * 1.18), 2),
            "analyst_count": int(stock.analyst_count or 0),
            "dispersion_ratio": score_breakdown["dispersion_ratio"],
            "upside_pct": score_breakdown["upside_pct"],
            "discount_from_52w_high_pct": score_breakdown["discount_52w_pct"],
        },
        "fundamentals_and_technicals": {
            "trailing_pe": round(float(stock.trailing_pe or 0.0), 1),
            "forward_pe": round(float(stock.forward_pe or 0.0), 1),
            "roe_pct": round(float(stock.roe_pct or 0.0), 1),
            "roa_pct": round(float(stock.roa_pct or 0.0), 2),
            "debt_to_equity": round(float(stock.debt_to_equity or 0.0), 2),
            "market_cap_cr": round(float(stock.market_cap_cr or 0.0), 0),
            "delivery_pct": round(float(stock.delivery_pct or 0.0), 1),
            "volume_surge_ratio": round(float(stock.volume_surge_ratio or 1.0), 2),
            "ema_20": round(float(stock.ema_20), 2),
            "ema_50": round(float(stock.ema_50), 2),
            "ema_200": round(float(stock.ema_200), 2),
            "rsi_14": round(float(stock.rsi_14), 1),
            "atr_14": round(float(stock.atr_14), 2),
            "swing_low_20d": round(float(stock.swing_low_20d), 2),
            "rs_20d": round(float(stock.rs_20d), 2),
            "vcp_tightness_ratio": round(float(stock.vcp_tightness_ratio), 2),
            "days_until_earnings": stock.days_until_earnings,
        },
        "score_breakdown": score_breakdown,
        "trade_ticket": trade_ticket,
        "ai_debate": ai_report,
        "backtest_summary": backtest_summary,
        "ohlcv_history": ohlcv_series,
        "data_source": stock.data_source,
        "updated_at": stock.updated_at.isoformat() if stock.updated_at else datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/stock/{ticker}/ai-debate")
async def run_live_ai_debate_endpoint(
    ticker: str,
    req: AIDebateTriggerRequest,
    db: Session = Depends(get_db),
):
    norm_ticker = ensure_ns_suffix(ticker) if req.market == "INDIA_NSE" else ticker.upper().strip()
    stock = get_cached_stock(db, norm_ticker, market=req.market)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

    regime_data = REGIME_CACHE.get(req.market) or evaluate_market_regime(req.market)
    score_breakdown = compute_bargain_velocity_score(stock)
    trade_ticket = compute_actionable_trade_ticket(
        stock=stock,
        family_capital=req.capital,
        user_risk_pct=req.risk_pct,
        regime_multiplier=float(regime_data.get("sizing_multiplier") or 1.0),
        regime_name=str(regime_data.get("regime") or "GREEN_BULL"),
    )
    ai_report = await generate_family_ai_debate(
        stock=stock,
        score_breakdown=score_breakdown,
        trade_ticket=trade_ticket,
        db=db,
        force_live_gemini=True,
        override_api_key=req.gemini_api_key,
    )
    return ai_report


# ==============================================================================
# 5. 3-YEAR HISTORICAL STRATEGY BACKTESTER ENDPOINT
# ==============================================================================
@app.get("/api/backtest/{ticker}")
async def get_stock_backtest(
    ticker: str,
    market: str = Query(default="INDIA_NSE"),
    db: Session = Depends(get_db),
):
    norm_ticker = ensure_ns_suffix(ticker) if market == "INDIA_NSE" else ticker.upper().strip()
    stock = get_cached_stock(db, norm_ticker, market=market)
    if not stock:
        stock = build_cached_stock_model(norm_ticker, market)

    hist_df = None
    try:
        if market == "INDIA_NSE":
            b = await asyncio.wait_for(india_adapter.fetch_stock_deep_dive(norm_ticker, period="3y"), timeout=7.0)
        else:
            b = await asyncio.wait_for(us_adapter.fetch_stock_deep_dive(norm_ticker, period="3y"), timeout=7.0)
        hist_df = b.get("history_df")
    except Exception:
        hist_df = None

    if hist_df is None or hist_df.empty or len(hist_df) < 40:
        hist_df = generate_synthetic_ohlcv(
            current_price=float(stock.current_price),
            high_52w=float(stock.high_52w),
            low_52w=float(stock.low_52w),
            bars=520,
            seed_key=stock.ticker,
        )

    return run_historical_backtest(stock.ticker, hist_df, market=market)


# ==============================================================================
# 6. SHARED FAMILY PORTFOLIO & CAPITAL VELOCITY TRACKER CRUD
# ==============================================================================
def _enrich_portfolio_position(pos: FamilyPosition, db: Session) -> Dict[str, Any]:
    stock = get_cached_stock(db, pos.ticker, market=pos.market)
    current_price = float(stock.current_price) if stock and stock.current_price else float(pos.entry_price * 1.05)
    currency = "₹" if pos.market == "INDIA_NSE" else "$"

    invested_value = round(pos.shares * pos.entry_price, 2)
    current_value = round(pos.shares * current_price, 2)
    gross_pnl = round(current_value - invested_value, 2)
    pnl_pct = round(((current_price - pos.entry_price) / pos.entry_price) * 100.0, 2) if pos.entry_price > 0 else 0.0

    # Net post-friction P&L estimate
    friction_rate = 0.0025 if pos.market == "INDIA_NSE" else 0.0005
    friction_cost = round(invested_value * friction_rate, 2)
    tax_reserve = round(max(0.0, gross_pnl - friction_cost) * 0.125, 2)
    net_pnl = round(gross_pnl - friction_cost - tax_reserve, 2)

    # Progress toward Target 1 (3M) and Target 2 (6M)
    t1_span = max(0.01, pos.target_1_price - pos.entry_price)
    t2_span = max(0.01, pos.target_2_price - pos.entry_price)
    progress_to_t1_pct = round(max(0.0, min(100.0, ((current_price - pos.entry_price) / t1_span) * 100.0)), 1)
    progress_to_t2_pct = round(max(0.0, min(100.0, ((current_price - pos.entry_price) / t2_span) * 100.0)), 1)

    # Days held
    try:
        entry_dt = datetime.strptime(pos.entry_date[:10], "%Y-%m-%d").date()
        days_held = max(1, (datetime.now(timezone.utc).date() - entry_dt).days)
    except Exception:
        days_held = 15

    # Automated Capital Velocity & Risk Alerts per PRD Section 4 & 5.1
    alerts: List[Dict[str, str]] = []
    if current_price >= pos.target_2_price:
        alerts.append({
            "type": "SUCCESS",
            "badge": "🏆 TARGET 2 REACHED — BOOK FULL PROFIT",
            "message": f"Price ({currency}{current_price:,.2f}) reached 6M Consensus Target 2 ({currency}{pos.target_2_price:,.2f}). Lock in full family gains.",
        })
    elif current_price >= pos.target_1_price and not pos.partial_booked:
        alerts.append({
            "type": "PROFIT_BOOK",
            "badge": "🎯 BOOK 50% PROFIT AT T1",
            "message": f"Price ({currency}{current_price:,.2f}) hit 3M Target 1 ({currency}{pos.target_1_price:,.2f}). Book {max(1, pos.shares // 2)} shares and trail Stop-Loss to entry ({currency}{pos.entry_price:,.2f}).",
        })

    if current_price <= pos.stop_loss_price * 1.025:
        alerts.append({
            "type": "DANGER",
            "badge": "⚠️ NEAR STOP LOSS",
            "message": f"Price ({currency}{current_price:,.2f}) is within 2.5% of Hard Safety Stop-Loss ({currency}{pos.stop_loss_price:,.2f}). Protect family capital.",
        })

    if days_held >= 75 and abs(pnl_pct) < 5.0:
        alerts.append({
            "type": "ROTATION",
            "badge": f"💤 {days_held} DAYS FLAT — CONSIDER ROTATION",
            "message": f"Position held for {days_held} days with only {pnl_pct:+.1f}% move. Consider rotating into a higher-velocity >80 score bargain.",
        })

    if not alerts:
        alerts.append({
            "type": "HOLD",
            "badge": "✅ ON TRACK — COMPOUNDING",
            "message": f"Holding above Stop-Loss ({currency}{pos.stop_loss_price:,.2f}); {progress_to_t1_pct:.0f}% of the way to 3M Target 1 ({currency}{pos.target_1_price:,.2f}).",
        })

    return {
        "id": pos.id,
        "ticker": pos.ticker,
        "company_name": pos.company_name,
        "market": pos.market,
        "currency_symbol": currency,
        "sector": pos.sector,
        "owner": pos.owner,
        "status": pos.status,
        "shares": pos.shares,
        "entry_price": round(pos.entry_price, 2),
        "current_price": round(current_price, 2),
        "entry_date": pos.entry_date,
        "days_held": days_held,
        "stop_loss_price": round(pos.stop_loss_price, 2),
        "target_1_price": round(pos.target_1_price, 2),
        "target_2_price": round(pos.target_2_price, 2),
        "partial_booked": pos.partial_booked,
        "invested_value": invested_value,
        "current_value": current_value,
        "gross_pnl": gross_pnl,
        "net_post_friction_pnl": net_pnl,
        "pnl_pct": pnl_pct,
        "progress_to_t1_pct": progress_to_t1_pct,
        "progress_to_t2_pct": progress_to_t2_pct,
        "alerts": alerts,
        "notes": pos.notes or "",
    }


@app.get("/api/portfolio")
async def list_portfolio(
    owner: Optional[str] = Query(default=None),
    market: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(FamilyPosition)
    if owner and owner.upper() != "ALL":
        q = q.filter(FamilyPosition.owner == owner)
    if market and market.upper() != "ALL":
        q = q.filter(FamilyPosition.market == market)

    positions = q.order_by(FamilyPosition.id.asc()).all()
    enriched = [_enrich_portfolio_position(p, db) for p in positions]

    # Compute summary totals per market
    inr_positions = [p for p in enriched if p["market"] == "INDIA_NSE" and p["status"] == "ACTIVE"]
    usd_positions = [p for p in enriched if p["market"] == "US_NYSE" and p["status"] == "ACTIVE"]

    def _summarize(pos_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        inv = round(sum(p["invested_value"] for p in pos_list), 2)
        cur = round(sum(p["current_value"] for p in pos_list), 2)
        gpnl = round(sum(p["gross_pnl"] for p in pos_list), 2)
        npnl = round(sum(p["net_post_friction_pnl"] for p in pos_list), 2)
        pct = round(((cur - inv) / inv) * 100.0, 2) if inv > 0 else 0.0
        return {
            "active_positions": len(pos_list),
            "total_invested": inv,
            "total_current_value": cur,
            "total_gross_pnl": gpnl,
            "total_net_pnl": npnl,
            "total_return_pct": pct,
        }

    return {
        "positions": enriched,
        "summary_india_inr": _summarize(inr_positions),
        "summary_us_usd": _summarize(usd_positions),
    }


@app.post("/api/portfolio")
async def create_portfolio_position(
    req: PortfolioCreateRequest,
    db: Session = Depends(get_db),
):
    norm_ticker = ensure_ns_suffix(req.ticker) if req.market == "INDIA_NSE" else req.ticker.upper().strip()
    stock = get_cached_stock(db, norm_ticker, market=req.market)

    company_name = req.company_name or (stock.company_name if stock else norm_ticker)
    sector = req.sector or (stock.sector if stock else "Industrials")
    entry_p = float(req.entry_price)

    stop_p = float(req.stop_loss_price) if req.stop_loss_price else round(entry_p * 0.925, 2)
    t2_p = float(req.target_2_price) if req.target_2_price else (round(float(stock.target_median_price), 2) if stock and stock.target_median_price > entry_p else round(entry_p * 1.22, 2))
    t1_p = float(req.target_1_price) if req.target_1_price else round(entry_p + 0.55 * (t2_p - entry_p), 2)

    pos = FamilyPosition(
        ticker=norm_ticker,
        company_name=company_name,
        market=req.market,
        sector=sector,
        owner=req.owner,
        status=req.status,
        shares=req.shares,
        entry_price=entry_p,
        entry_date=req.entry_date or datetime.now(timezone.utc).date().isoformat(),
        stop_loss_price=stop_p,
        target_1_price=t1_p,
        target_2_price=t2_p,
        partial_booked=req.partial_booked,
        notes=req.notes or "",
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return _enrich_portfolio_position(pos, db)


@app.put("/api/portfolio/{position_id}")
async def update_portfolio_position(
    position_id: int,
    req: PortfolioUpdateRequest,
    db: Session = Depends(get_db),
):
    pos = db.query(FamilyPosition).filter(FamilyPosition.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Portfolio position not found")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None and hasattr(pos, k):
            setattr(pos, k, v)

    pos.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pos)
    return _enrich_portfolio_position(pos, db)


@app.delete("/api/portfolio/{position_id}")
async def delete_portfolio_position(
    position_id: int,
    db: Session = Depends(get_db),
):
    pos = db.query(FamilyPosition).filter(FamilyPosition.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Portfolio position not found")
    db.delete(pos)
    db.commit()
    return {"deleted": True, "id": position_id}


# ==============================================================================
# 7. ONE-CLICK JSON BACKUP EXPORT & IMPORT
# ==============================================================================
@app.get("/api/backup/export")
async def backup_export(db: Session = Depends(get_db)):
    return export_backup_json(db)


@app.post("/api/backup/import")
async def backup_import(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    counts = import_backup_json(db, payload, replace_existing=True)
    return {"status": "restored", **counts}
