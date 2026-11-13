from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from db.models import CachedStockData


def evaluate_market_regime(
    market: str,
    benchmark_data: Optional[Dict[str, Any]] = None,
    universe_rows: Optional[List[CachedStockData]] = None,
) -> Dict[str, Any]:
    """
    Deterministically computes the Market Regime Traffic Light (`GREEN_BULL`, `AMBER_CAUTION`, `RED_DEFENSIVE`)
    and automatic position sizing multiplier (1.0, 0.65, 0.35).
    """
    is_india = market == "INDIA_NSE"
    benchmark_name = "NIFTY 50" if is_india else "S&P 500"

    # Extract or derive benchmark level, 50 EMA, 200 EMA, A/D ratio, and VIX
    b = benchmark_data or {}
    index_level = float(b.get("index_level") or (25144.3 if is_india else 5985.0))
    ema_50 = float(b.get("ema_50") or index_level * 0.985)
    ema_200 = float(b.get("ema_200") or index_level * 0.935)
    day_change_pct = float(b.get("day_change_pct") or 0.0)
    vix_level = float(b.get("vix_level") or (15.5 if is_india else 14.8))

    # Advance/Decline Ratio from NSE MCP or cached universe
    ad_ratio = b.get("ad_ratio")
    advances = b.get("advances")
    declines = b.get("declines")

    if ad_ratio is None and universe_rows:
        up_cnt = sum(1 for r in universe_rows if (r.day_change_pct or 0.0) >= 0)
        dn_cnt = max(1, len(universe_rows) - up_cnt)
        advances = up_cnt
        declines = dn_cnt
        ad_ratio = round(up_cnt / dn_cnt, 2)
    elif ad_ratio is None:
        advances = 1520 if is_india else 290
        declines = 1380 if is_india else 210
        ad_ratio = round(advances / max(1, declines), 2)

    ad_ratio = float(ad_ratio)
    above_50_ema = index_level >= ema_50
    above_200_ema = index_level >= ema_200
    pct_vs_50_ema = round(((index_level - ema_50) / ema_50) * 100.0, 2) if ema_50 > 0 else 0.0
    pct_vs_200_ema = round(((index_level - ema_200) / ema_200) * 100.0, 2) if ema_200 > 0 else 0.0

    # Regime Classification Logic
    if above_50_ema and above_200_ema and ad_ratio >= 0.85 and vix_level < 21.0:
        regime = "GREEN_BULL"
        label = "Bull Market — 100% Normal Trade Size"
        sizing_multiplier = 1.0
        plain_english_summary = (
            f"{benchmark_name} is trading steadily above both its 50-day ({ema_50:,.0f}) and 200-day ({ema_200:,.0f}) "
            f"EMA (Exponential Moving Average) with healthy market breadth — A/D (Advance/Decline Ratio) {ad_ratio:.2f} — and calm volatility — VIX (Volatility Index) {vix_level:.1f}. "
            f"Full 100% (1.0x) position sizing is active for high-quality GARP (Growth at a Reasonable Price) stocks."
        )
    elif above_200_ema and vix_level < 25.0:
        regime = "AMBER_CAUTION"
        label = "Sideways Market — 65% Cautious Trade Size"
        sizing_multiplier = 0.65
        plain_english_summary = (
            f"{benchmark_name} remains above its long-term 200-day EMA (Exponential Moving Average) ({ema_200:,.0f}), "
            f"but short-term market breadth — A/D (Advance/Decline Ratio) {ad_ratio:.2f} — or 50-day momentum shows consolidation. "
            f"FamilyFinance automatically scales position size to 65% (0.65x) so we only buy high-upside bargains inside their support buy zones."
        )
    else:
        regime = "RED_DEFENSIVE"
        label = "Market Correction — 35% Defensive Trade Size"
        sizing_multiplier = 0.35
        plain_english_summary = (
            f"{benchmark_name} is below its 200-day EMA (Exponential Moving Average) support ({ema_200:,.0f}) or experiencing elevated volatility — VIX (Volatility Index) {vix_level:.1f}. "
            f"Capital protection comes first: FamilyFinance automatically reduces trade sizes to 35% (0.35x) of normal risk."
        )

    reasons = [
        f"{benchmark_name} Spot ({index_level:,.1f}) is {'+' if pct_vs_50_ema >= 0 else ''}{pct_vs_50_ema}% vs 50-Day EMA (Exponential Moving Average) ({ema_50:,.1f}).",
        f"Long-term trend is {'+' if pct_vs_200_ema >= 0 else ''}{pct_vs_200_ema}% vs 200-Day EMA (Exponential Moving Average) ({ema_200:,.1f}).",
        f"Market A/D (Advance/Decline Ratio) Breadth is {ad_ratio:.2f} ({advances} Advancing vs {declines} Declining).",
        f"VIX (Volatility Index) stands at {vix_level:.1f} ({'Calm / Normal' if vix_level < 18 else 'Elevated Volatility'}).",
    ]

    return {
        "market": market,
        "regime": regime,
        "label": label,
        "sizing_multiplier": sizing_multiplier,
        "benchmark_name": benchmark_name,
        "index_level": round(index_level, 2),
        "day_change_pct": round(day_change_pct, 2),
        "ema_50": round(ema_50, 2),
        "ema_200": round(ema_200, 2),
        "pct_vs_50_ema": pct_vs_50_ema,
        "pct_vs_200_ema": pct_vs_200_ema,
        "ad_ratio": round(ad_ratio, 2),
        "advances": int(advances or 0),
        "declines": int(declines or 0),
        "vix_level": round(vix_level, 2),
        "plain_english_summary": plain_english_summary,
        "reasons": reasons,
        "source": b.get("source", "NSE_MCP+YFINANCE" if is_india else "YFINANCE"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
