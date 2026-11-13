import math
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd


def compute_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50.0)


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["High"]
    low = df["Low"]
    close = df["Close"]
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean().bfill()


def compute_technical_snapshot(
    df: pd.DataFrame,
    benchmark_return_20d_pct: float = 1.5,
) -> Dict[str, Any]:
    """
    Deterministically computes EMA(20,50,200), RSI(14), ATR(14), 20D Swing Low,
    Up-day Volume Surge Ratio (5D vs 20D), Relative Strength (RS_20D), and VCP tightness ratio.
    """
    if df is None or df.empty or len(df) < 5:
        return {}

    df = df.copy()
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["Close"])
    if df.empty:
        return {}

    close = df["Close"]
    high = df["High"] if "High" in df.columns else close
    low = df["Low"] if "Low" in df.columns else close
    volume = df["Volume"].fillna(0.0) if "Volume" in df.columns else pd.Series(0.0, index=df.index)

    current_price = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else current_price
    day_change_pct = ((current_price - prev_close) / prev_close * 100.0) if prev_close > 0 else 0.0

    ema_20_s = compute_ema(close, 20)
    ema_50_s = compute_ema(close, 50)
    ema_200_s = compute_ema(close, 200)
    rsi_14_s = compute_rsi(close, 14)
    atr_14_s = compute_atr(df, 14)

    ema_20 = float(ema_20_s.iloc[-1])
    ema_50 = float(ema_50_s.iloc[-1])
    ema_200 = float(ema_200_s.iloc[-1])
    rsi_14 = float(rsi_14_s.iloc[-1])
    atr_14 = float(atr_14_s.iloc[-1]) if not math.isnan(float(atr_14_s.iloc[-1])) else current_price * 0.02

    # 20-Day Swing Low
    window_20_low = low.tail(20)
    swing_low_20d = float(window_20_low.min()) if not window_20_low.empty else current_price * 0.95

    # 52-Week High and Low from history (up to 252 trading days)
    window_252_high = high.tail(252)
    window_252_low = low.tail(252)
    high_52w = float(window_252_high.max()) if not window_252_high.empty else current_price * 1.2
    low_52w = float(window_252_low.min()) if not window_252_low.empty else current_price * 0.8

    # Volume Surge Ratio on Up-Days: Avg_Volume_5D (up-days) / Avg_Volume_20D
    avg_vol_20d = float(volume.tail(20).mean()) if len(volume) >= 5 else 1.0
    recent_5 = df.tail(5)
    up_days_5 = recent_5[recent_5["Close"] >= recent_5["Close"].shift(1).fillna(recent_5["Open"])]
    if not up_days_5.empty and avg_vol_20d > 0:
        avg_vol_5d_up = float(up_days_5["Volume"].mean())
    else:
        avg_vol_5d_up = float(volume.tail(5).mean()) if len(volume) >= 5 else avg_vol_20d
    volume_surge_ratio = (avg_vol_5d_up / avg_vol_20d) if avg_vol_20d > 0 else 1.0

    # 20-Day Relative Strength vs Benchmark
    if len(close) >= 21 and float(close.iloc[-21]) > 0:
        stock_ret_20d_pct = ((current_price - float(close.iloc[-21])) / float(close.iloc[-21])) * 100.0
    elif len(close) >= 5 and float(close.iloc[0]) > 0:
        stock_ret_20d_pct = ((current_price - float(close.iloc[0])) / float(close.iloc[0])) * 100.0
    else:
        stock_ret_20d_pct = 0.0
    rs_20d = stock_ret_20d_pct - benchmark_return_20d_pct

    # Volatility Contraction Pattern (VCP) Tightness: 10D High-Low % range vs 30D High-Low % range
    high_10 = float(high.tail(10).max())
    low_10 = float(low.tail(10).min())
    high_30 = float(high.tail(30).max())
    low_30 = float(low.tail(30).min())

    range_10_pct = ((high_10 - low_10) / current_price * 100.0) if current_price > 0 else 5.0
    range_30_pct = ((high_30 - low_30) / current_price * 100.0) if current_price > 0 else 10.0
    vcp_tightness_ratio = (range_10_pct / range_30_pct) if range_30_pct > 0 else 0.85

    return {
        "current_price": round(current_price, 2),
        "previous_close": round(prev_close, 2),
        "day_change_pct": round(day_change_pct, 2),
        "high_52w": round(high_52w, 2),
        "low_52w": round(low_52w, 2),
        "ema_20": round(ema_20, 2),
        "ema_50": round(ema_50, 2),
        "ema_200": round(ema_200, 2),
        "rsi_14": round(rsi_14, 1),
        "atr_14": round(max(atr_14, current_price * 0.008), 2),
        "swing_low_20d": round(swing_low_20d, 2),
        "volume_surge_ratio": round(max(0.4, min(volume_surge_ratio, 4.5)), 2),
        "last_volume": float(volume.iloc[-1]) if not volume.empty else 0.0,
        "rs_20d": round(rs_20d, 2),
        "vcp_tightness_ratio": round(vcp_tightness_ratio, 2),
    }
