from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from db.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class CachedStockData(Base):
    __tablename__ = "cached_stock_data"

    ticker = Column(String(32), primary_key=True, index=True)
    market = Column(String(24), index=True, nullable=False, default="INDIA_NSE")
    company_name = Column(String(128), nullable=False)
    sector = Column(String(64), nullable=False, default="Industrials")
    industry = Column(String(96), nullable=True, default="")

    # Price & 52-Week Range
    current_price = Column(Float, nullable=False, default=0.0)
    previous_close = Column(Float, nullable=False, default=0.0)
    day_change_pct = Column(Float, nullable=False, default=0.0)
    high_52w = Column(Float, nullable=False, default=0.0)
    low_52w = Column(Float, nullable=False, default=0.0)

    # Consensus Analyst Targets
    target_median_price = Column(Float, nullable=False, default=0.0)
    target_mean_price = Column(Float, nullable=False, default=0.0)
    target_high_price = Column(Float, nullable=False, default=0.0)
    target_low_price = Column(Float, nullable=False, default=0.0)
    analyst_count = Column(Integer, nullable=False, default=0)

    # Valuation & Balance Sheet Quality
    trailing_pe = Column(Float, nullable=True, default=20.0)
    forward_pe = Column(Float, nullable=True, default=17.0)
    roe_pct = Column(Float, nullable=False, default=15.0)
    roa_pct = Column(Float, nullable=False, default=5.0)
    debt_to_equity = Column(Float, nullable=True, default=0.3)
    market_cap_cr = Column(Float, nullable=True, default=50000.0)

    # Institutional Delivery & Volume Accumulation
    delivery_pct = Column(Float, nullable=False, default=48.0)
    volume_surge_ratio = Column(Float, nullable=False, default=1.2)
    last_volume = Column(Float, nullable=True, default=1000000.0)

    # Technical Inflection & Relative Strength
    ema_20 = Column(Float, nullable=False, default=0.0)
    ema_50 = Column(Float, nullable=False, default=0.0)
    ema_200 = Column(Float, nullable=False, default=0.0)
    rsi_14 = Column(Float, nullable=False, default=52.0)
    atr_14 = Column(Float, nullable=False, default=15.0)
    swing_low_20d = Column(Float, nullable=False, default=0.0)
    rs_20d = Column(Float, nullable=False, default=2.0)
    vcp_tightness_ratio = Column(Float, nullable=False, default=0.82)

    # Earnings Blackout Check
    days_until_earnings = Column(Integer, nullable=True, default=45)

    # Metadata
    data_source = Column(String(64), nullable=False, default="NSE_MCP+YFINANCE")
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class FamilyPosition(Base):
    __tablename__ = "family_positions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticker = Column(String(32), index=True, nullable=False)
    company_name = Column(String(128), nullable=False)
    market = Column(String(24), nullable=False, default="INDIA_NSE")
    sector = Column(String(64), nullable=False, default="Industrials")
    owner = Column(String(32), nullable=False, default="Joint")  # "Saksham" | "Family" | "Joint"
    status = Column(String(24), nullable=False, default="ACTIVE")  # "ACTIVE" | "WATCHLIST" | "CLOSED"
    shares = Column(Integer, nullable=False, default=10)
    entry_price = Column(Float, nullable=False)
    entry_date = Column(String(16), nullable=False)  # YYYY-MM-DD
    stop_loss_price = Column(Float, nullable=False)
    target_1_price = Column(Float, nullable=False)
    target_2_price = Column(Float, nullable=False)
    partial_booked = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True, default="")
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ScreenerPreset(Base):
    __tablename__ = "screener_presets"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(96), nullable=False)
    badge = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    min_upside_pct = Column(Float, nullable=False, default=18.0)
    min_discount_52w_pct = Column(Float, nullable=False, default=10.0)
    max_discount_52w_pct = Column(Float, nullable=False, default=40.0)
    min_roe_pct = Column(Float, nullable=False, default=13.0)
    max_debt_to_equity = Column(Float, nullable=False, default=0.8)
    min_delivery_pct = Column(Float, nullable=False, default=40.0)
    min_rsi = Column(Float, nullable=False, default=40.0)
    max_rsi = Column(Float, nullable=False, default=68.0)
    min_analyst_count = Column(Integer, nullable=False, default=3)
    risk_per_trade_pct = Column(Float, nullable=False, default=1.0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AuditSignalLog(Base):
    __tablename__ = "audit_signal_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticker = Column(String(32), index=True, nullable=False)
    market = Column(String(24), nullable=False, default="INDIA_NSE")
    signal_date = Column(String(16), nullable=False)
    bargain_score = Column(Float, nullable=False)
    verdict = Column(String(64), nullable=False)
    entry_price = Column(Float, nullable=False)
    target_1 = Column(Float, nullable=False)
    target_2 = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    ai_summary = Column(Text, nullable=True, default="")
    raw_payload = Column(Text, nullable=True, default="{}")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AIReportCache(Base):
    __tablename__ = "ai_reports_cache"

    cache_key = Column(String(64), primary_key=True, index=True)  # "<TICKER>_<YYYY-MM-DD>"
    ticker = Column(String(32), index=True, nullable=False)
    report_date = Column(String(16), index=True, nullable=False)  # YYYY-MM-DD
    model_used = Column(String(64), nullable=False, default="gemini-3.8-flash")
    report_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

