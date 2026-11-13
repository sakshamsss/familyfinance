import os
from pathlib import Path
from typing import List, Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from universe_catalog import (
    INDIA_LARGE_CAP_100,
    INDIA_MID_CAP_400,
    INDIA_SMALL_CAP_150,
    US_LARGE_CAP_100,
    US_MID_CAP_100,
    US_SMALL_CAP_50,
    ALL_CATALOG_META,
)

BASE_DIR = Path(__file__).resolve().parent
ROOT_ENV = BASE_DIR.parent / ".env"
LOCAL_ENV = BASE_DIR / ".env"


class Settings(BaseSettings):
    FAMILY_ACCESS_PIN: str = "0410"
    FAMILY_PIN: str = "0410"
    SESSION_SECRET_KEY: str = "familyfinance-institutional-vault-hmac-secret-2026"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'family_alpha.db'}"
    GEMINI_API_KEY: str = ""
    PRIMARY_AI_MODEL: str = "gemini-3.8-flash"
    FALLBACK_AI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_MODEL: str = "gemini-3.8-flash"
    FINNHUB_API_KEY: str = ""
    NSE_MCP_BHAVCOPY_URL: str = "https://mcp.nseindia.in/bhavcopy/cm/mcp"
    NSE_MCP_CM_MARKET_URL: str = "https://mcp.nseindia.in/cmmkt/mcp"
    NSE_MCP_TIMEOUT_SECONDS: float = 8.0
    DEFAULT_FAMILY_CAPITAL_INR: float = 500000.0
    DEFAULT_FAMILY_CAPITAL_USD: float = 25000.0
    DEFAULT_RISK_PER_TRADE_PCT: float = 1.0
    MAX_SINGLE_POSITION_ALLOCATION_PCT: float = 18.0

    model_config = SettingsConfigDict(
        env_file=[str(ROOT_ENV), str(LOCAL_ENV)],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# ==============================================================================
# EXPANDED INDIA NSE UNIVERSE (650 TOTAL: 500 NIFTY 500 LARGE/MID-CAP + 150 SMALL-CAP)
# ==============================================================================
INDIA_NSE_UNIVERSE: List[str] = INDIA_LARGE_CAP_100 + INDIA_MID_CAP_400 + INDIA_SMALL_CAP_150

# ==============================================================================
# EXPANDED US EQUITIES UNIVERSE (250 TOTAL: 100 LARGE-CAP + 100 MID-CAP + 50 SMALL-CAP)
# ==============================================================================
US_EQUITIES_UNIVERSE: List[str] = US_LARGE_CAP_100 + US_MID_CAP_100 + US_SMALL_CAP_50

# Priority liquid subset for fast non-blocking background batch quote sync
PRIORITY_INDIA_QUOTE_SYNC: List[str] = INDIA_LARGE_CAP_100[:60] + INDIA_MID_CAP_400[:40]
PRIORITY_US_QUOTE_SYNC: List[str] = US_LARGE_CAP_100[:40] + US_MID_CAP_100[:20]

# Strategy Presets matching Section 5.1 of the PRD
DEFAULT_STRATEGY_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "safe_compounder",
        "name": "Safe Blue-Chip Compounder",
        "badge": "Safe Compounder",
        "description": "High balance-sheet safety, strong ROE (Return on Equity) >= 15%, low D/E (Debt-to-Equity), and conservative 0.75% capital risk per trade.",
        "min_upside_pct": 18.0,
        "min_discount_52w_pct": 10.0,
        "max_discount_52w_pct": 40.0,
        "min_roe_pct": 15.0,
        "max_debt_to_equity": 0.6,
        "min_delivery_pct": 40.0,
        "min_rsi": 40.0,
        "max_rsi": 66.0,
        "min_analyst_count": 3,
        "risk_per_trade_pct": 0.75,
    },
    {
        "id": "high_velocity_bargain",
        "name": "Value Bargain Hunter",
        "badge": "Bargain Hunter",
        "description": "Targets high consensus analyst upside (>= 25%) sitting in the 15%–38% discount sweet-spot below 52W (52-Week) High.",
        "min_upside_pct": 25.0,
        "min_discount_52w_pct": 15.0,
        "max_discount_52w_pct": 38.0,
        "min_roe_pct": 13.0,
        "max_debt_to_equity": 0.8,
        "min_delivery_pct": 42.0,
        "min_rsi": 42.0,
        "max_rsi": 65.0,
        "min_analyst_count": 3,
        "risk_per_trade_pct": 1.0,
    },
    {
        "id": "institutional_breakout_swing",
        "name": "Momentum & Delivery Swing",
        "badge": "Breakout Swing",
        "description": "Focuses on strong institutional delivery accumulation, volume surges >1.3x, and momentum inflection with RSI (Relative Strength Index) 50–65.",
        "min_upside_pct": 15.0,
        "min_discount_52w_pct": 8.0,
        "max_discount_52w_pct": 35.0,
        "min_roe_pct": 12.0,
        "max_debt_to_equity": 1.0,
        "min_delivery_pct": 45.0,
        "min_rsi": 50.0,
        "max_rsi": 65.0,
        "min_analyst_count": 3,
        "risk_per_trade_pct": 1.25,
    },
]
