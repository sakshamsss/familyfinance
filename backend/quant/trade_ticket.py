import math
from typing import Dict, Any
from db.models import CachedStockData
from config import settings


def compute_actionable_trade_ticket(
    stock: CachedStockData,
    family_capital: float = 500000.0,
    user_risk_pct: float = 1.0,
    regime_multiplier: float = 1.0,
    regime_name: str = "GREEN_BULL",
) -> Dict[str, Any]:
    """
    Deterministically computes the 3-6 Month Actionable Trade Ticket per PRD Section 3.4.
    Zero LLM math — all levels, share quantities, friction, and tax reserves are exact Python math.
    """
    current_price = max(float(stock.current_price or 100.0), 0.01)
    ema_20 = float(stock.ema_20 or current_price * 0.99)
    swing_low_20d = float(stock.swing_low_20d or current_price * 0.95)
    atr_14 = max(float(stock.atr_14 or current_price * 0.02), current_price * 0.008)

    # 1. Buy Zone (buy_zone_low, buy_zone_high)
    support_anchor = max(ema_20, swing_low_20d)
    buy_zone_low = round(min(current_price * 0.985, support_anchor), 2)
    buy_zone_high = round(current_price * 1.01, 2)

    # 2. Safety Exit / Stop-Loss (stop_loss_price) clamped between -5.5% and -10.0% from entry
    atr_stop = buy_zone_low - (2.2 * atr_14)
    structural_stop = swing_low_20d * 0.985
    raw_stop = min(atr_stop, structural_stop)

    max_stop_price = current_price * (1.0 - 0.055)  # -5.5% from current_price
    min_stop_price = current_price * (1.0 - 0.100)  # -10.0% from current_price
    stop_loss_price = round(max(min_stop_price, min(raw_stop, max_stop_price)), 2)
    stop_loss_pct = round(((stop_loss_price - current_price) / current_price) * 100.0, 2)

    # 3. Profit Targets (target_1_3m, target_2_6m)
    consensus_target = float(stock.target_median_price or stock.target_mean_price or 0.0)
    if consensus_target <= current_price * 1.05:
        consensus_target = current_price * 1.20
    target_2_6m = round(consensus_target, 2)
    target_1_3m = round(current_price + 0.55 * (target_2_6m - current_price), 2)

    target_1_upside_pct = round(((target_1_3m - current_price) / current_price) * 100.0, 2)
    target_2_upside_pct = round(((target_2_6m - current_price) / current_price) * 100.0, 2)

    # 4. Regime-Adjusted Family Position Sizing with 18% Diversification Cap
    effective_risk_pct = round(user_risk_pct * regime_multiplier, 3)
    max_rupee_risk = family_capital * (effective_risk_pct / 100.0)
    risk_per_share = max(current_price - stop_loss_price, current_price * 0.01)
    raw_shares = int(math.floor(max_rupee_risk / risk_per_share))

    max_cap_Pct = float(settings.MAX_SINGLE_POSITION_ALLOCATION_PCT)  # 18.0%
    max_capital_per_position = family_capital * (max_cap_Pct / 100.0)
    max_shares_by_cap = int(math.floor(max_capital_per_position / current_price))

    capped_by_diversification = raw_shares > max_shares_by_cap
    recommended_shares = max(1, min(raw_shares, max_shares_by_cap)) if family_capital >= current_price else 0
    total_investment_amount = round(recommended_shares * current_price, 2)
    actual_capital_risk_amount = round(recommended_shares * risk_per_share, 2)
    actual_portfolio_risk_pct = round((actual_capital_risk_amount / family_capital) * 100.0, 2) if family_capital > 0 else 0.0
    allocation_pct_of_capital = round((total_investment_amount / family_capital) * 100.0, 2) if family_capital > 0 else 0.0

    # 5. Net-of-Tax & Friction Calculation (India Delivery Equity Rules: ~0.25% friction + 12.5% tax reserve)
    is_india = stock.market == "INDIA_NSE"
    currency_symbol = "₹" if is_india else "$"
    friction_rate = 0.0025 if is_india else 0.0005  # 0.25% round-trip STT + Stamp + Exchange/SEBI for NSE
    tax_reserve_rate = 0.125  # 12.5% tax reserve per PRD Section 3.4

    # Full Target 2 Scenario
    exit_value_t2 = recommended_shares * target_2_6m
    gross_profit_t2 = round(exit_value_t2 - total_investment_amount, 2)
    round_trip_turnover_t2 = total_investment_amount + exit_value_t2
    friction_cost_t2 = round((round_trip_turnover_t2 / 2.0) * friction_rate, 2)
    taxable_gain_t2 = max(0.0, gross_profit_t2 - friction_cost_t2)
    tax_reserve_t2 = round(taxable_gain_t2 * tax_reserve_rate, 2)
    net_profit_t2 = round(gross_profit_t2 - friction_cost_t2 - tax_reserve_t2, 2)

    # Blended Family Plan (Book 50% at T1 + 50% at T2)
    shares_t1 = recommended_shares // 2
    shares_t2_rem = recommended_shares - shares_t1
    gross_profit_t1_half = round(shares_t1 * (target_1_3m - current_price), 2)
    gross_profit_blended = round(
        shares_t1 * (target_1_3m - current_price) + shares_t2_rem * (target_2_6m - current_price),
        2,
    )
    friction_cost_blended = round(total_investment_amount * friction_rate, 2)
    tax_reserve_blended = round(max(0.0, gross_profit_blended - friction_cost_blended) * tax_reserve_rate, 2)
    net_profit_blended = round(gross_profit_blended - friction_cost_blended - tax_reserve_blended, 2)

    reward_to_risk_t2 = round((target_2_6m - current_price) / risk_per_share, 2) if risk_per_share > 0 else 0.0

    # 6. 7-Day Earnings Blackout Check
    days_earn = stock.days_until_earnings
    earnings_warning = bool(days_earn is not None and 0 <= days_earn <= 7)
    if earnings_warning:
        earnings_badge = f"⏳ EARNINGS IN {days_earn} DAYS — WAIT FOR CLARITY"
    elif days_earn is not None:
        earnings_badge = f"✅ Next Earnings in ~{days_earn} Days (Clear Window)"
    else:
        earnings_badge = "✅ No Imminent Earnings Blackout"

    # Determine deterministic position status & action headline
    if earnings_warning:
        action_badge = "WAIT_FOR_EARNINGS"
    elif buy_zone_low <= current_price <= buy_zone_high * 1.015:
        action_badge = "ACCUMULATE_IN_BUY_ZONE"
    elif current_price > buy_zone_high * 1.015:
        action_badge = "BUY_ON_DIP"
    else:
        action_badge = "ACCUMULATE_IN_BUY_ZONE"

    return {
        "ticker": stock.ticker,
        "company_name": stock.company_name,
        "market": stock.market,
        "currency_symbol": currency_symbol,
        "current_price": round(current_price, 2),
        "action_badge": action_badge,
        "buy_zone_low": buy_zone_low,
        "buy_zone_high": buy_zone_high,
        "support_anchor": round(support_anchor, 2),
        "stop_loss_price": stop_loss_price,
        "stop_loss_pct": stop_loss_pct,
        "atr_stop_raw": round(atr_stop, 2),
        "structural_stop_raw": round(structural_stop, 2),
        "target_1_3m": target_1_3m,
        "target_1_upside_pct": target_1_upside_pct,
        "target_1_note": f"Book 50% ({shares_t1} shares) at {currency_symbol}{target_1_3m:,.2f} & trail Stop-Loss to breakeven ({currency_symbol}{current_price:,.2f}).",
        "target_2_6m": target_2_6m,
        "target_2_upside_pct": target_2_upside_pct,
        "target_2_note": f"Ride remaining {shares_t2_rem} shares to 6M Consensus Target ({currency_symbol}{target_2_6m:,.2f}).",
        "reward_to_risk_ratio": reward_to_risk_t2,
        "position_sizing": {
            "family_capital": round(family_capital, 2),
            "user_risk_pct": round(user_risk_pct, 2),
            "regime_name": regime_name,
            "regime_multiplier": regime_multiplier,
            "effective_risk_pct": effective_risk_pct,
            "max_rupee_risk": round(max_rupee_risk, 2),
            "risk_per_share": round(risk_per_share, 2),
            "raw_shares": raw_shares,
            "recommended_shares": recommended_shares,
            "shares_to_book_at_t1": shares_t1,
            "shares_to_ride_to_t2": shares_t2_rem,
            "total_investment_amount": total_investment_amount,
            "allocation_pct_of_capital": allocation_pct_of_capital,
            "max_allocation_cap_pct": max_cap_Pct,
            "capped_by_diversification": capped_by_diversification,
            "actual_capital_risk_amount": actual_capital_risk_amount,
            "actual_portfolio_risk_pct": actual_portfolio_risk_pct,
        },
        "profit_and_friction": {
            "gross_expected_profit_t2": gross_profit_t2,
            "friction_cost_t2": friction_cost_t2,
            "tax_reserve_t2": tax_reserve_t2,
            "net_post_friction_profit_t2": net_profit_t2,
            "gross_expected_profit_blended": gross_profit_blended,
            "friction_cost_blended": friction_cost_blended,
            "tax_reserve_blended": tax_reserve_blended,
            "net_post_friction_profit_blended": net_profit_blended,
            "friction_rate_pct": round(friction_rate * 100.0, 2),
            "tax_reserve_rate_pct": round(tax_reserve_rate * 100.0, 1),
            "friction_explanation": (
                "0.1% STT buy + 0.1% STT sell + ~0.05% Stamp/Exchange/SEBI (~0.25% total friction) + 12.5% tax reserve"
                if is_india
                else "SEC/FINRA & spread friction (~0.05%) + 12.5% tax reserve"
            ),
        },
        "earnings_check": {
            "days_until_next_earnings": days_earn,
            "earnings_warning": earnings_warning,
            "earnings_badge": earnings_badge,
        },
    }
