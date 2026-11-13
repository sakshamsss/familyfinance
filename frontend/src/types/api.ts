export type MarketType = 'INDIA_NSE' | 'US_NYSE';

export type RegimeStatus = 'GREEN_BULL' | 'AMBER_CAUTION' | 'RED_DEFENSIVE';

export interface RegimeInfo {
  market: MarketType;
  regime: RegimeStatus;
  label: string;
  sizing_multiplier: number;
  benchmark_name: string;
  index_level: number;
  day_change_pct: number;
  ema_50: number;
  ema_200: number;
  pct_vs_50_ema: number;
  pct_vs_200_ema: number;
  ad_ratio: number;
  advances: number;
  declines: number;
  vix_level: number;
  plain_english_summary: string;
  reasons: string[];
  source: string;
  updated_at: string;
}

export interface StrategyPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  min_upside_pct: number;
  min_discount_52w_pct: number;
  max_discount_52w_pct: number;
  min_roe_pct: number;
  max_debt_to_equity: number;
  min_delivery_pct: number;
  min_rsi: number;
  max_rsi: number;
  min_analyst_count: number;
  risk_per_trade_pct: number;
}

export type CapFilterType = 'ALL' | 'LARGE_AND_MID' | 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP';

export interface ScreenerFilterParams {
  market: MarketType;
  cap_filter?: CapFilterType;
  min_upside_pct: number;
  min_discount_52w_pct: number;
  max_discount_52w_pct: number;
  min_roe_pct: number;
  max_debt_to_equity: number;
  min_delivery_pct: number;
  min_rsi: number;
  max_rsi: number;
  min_analyst_count: number;
  sector_filter: string;
  capital: number;
  risk_pct: number;
}

export interface ScoreBreakdown {
  total_score: number;
  factor1_upside_pts: number;
  factor2_bargain_pts: number;
  factor3_quality_pts: number;
  factor4_inst_pts: number;
  factor5_timing_pts: number;
  factor6_rs_vcp_pts: number;
  upside_pct: number;
  discount_52w_pct: number;
  dispersion_ratio: number;
  consensus_target: number;
  forward_earnings_expansion: boolean;
  is_financial: boolean;
}

export interface ScreenerCandidate {
  ticker: string;
  company_name: string;
  market: MarketType;
  sector: string;
  industry: string;
  cap_category?: 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP';
  cap_label?: string;
  market_cap_cr?: number;
  current_price: number;
  day_change_pct: number;
  high_52w: number;
  low_52w: number;
  discount_52w_pct: number;
  consensus_target: number;
  target_high: number;
  target_low: number;
  upside_pct: number;
  analyst_count: number;
  trailing_pe: number;
  forward_pe: number;
  roe_pct: number;
  roa_pct: number;
  debt_to_equity: number;
  delivery_pct: number;
  volume_surge_ratio: number;
  rsi_14: number;
  ema_20: number;
  ema_50: number;
  ema_200: number;
  rs_20d: number;
  vcp_tightness_ratio: number;
  days_until_earnings: number | null;
  earnings_warning: boolean;
  bargain_score: number;
  score_breakdown: ScoreBreakdown;
  data_source: string;
  updated_at: string | null;
}

export interface FunnelCounts {
  universe_count: number;
  stage1_bargain_count: number;
  stage2_quality_count: number;
  stage3_timing_count: number;
}

export interface CapCounts {
  ALL: number;
  LARGE_AND_MID: number;
  LARGE_CAP: number;
  MID_CAP: number;
  SMALL_CAP: number;
}

export interface ScreenerResponse {
  market: MarketType;
  cap_counts?: CapCounts;
  funnel_counts: FunnelCounts;
  applied_filters: ScreenerFilterParams;
  candidates: ScreenerCandidate[];
  available_sectors: string[];
  cache_timestamp: string;
}

export interface PositionSizingInfo {
  family_capital: number;
  user_risk_pct: number;
  regime_name: string;
  regime_multiplier: number;
  effective_risk_pct: number;
  max_rupee_risk: number;
  risk_per_share: number;
  raw_shares: number;
  recommended_shares: number;
  shares_to_book_at_t1: number;
  shares_to_ride_to_t2: number;
  total_investment_amount: number;
  allocation_pct_of_capital: number;
  max_allocation_cap_pct: number;
  capped_by_diversification: boolean;
  actual_capital_risk_amount: number;
  actual_portfolio_risk_pct: number;
}

export interface ProfitAndFrictionInfo {
  gross_expected_profit_t2: number;
  friction_cost_t2: number;
  tax_reserve_t2: number;
  net_post_friction_profit_t2: number;
  gross_expected_profit_blended: number;
  friction_cost_blended: number;
  tax_reserve_blended: number;
  net_post_friction_profit_blended: number;
  friction_rate_pct: number;
  tax_reserve_rate_pct: number;
  friction_explanation: string;
}

export interface TradeTicket {
  ticker: string;
  company_name: string;
  market: MarketType;
  currency_symbol: string;
  current_price: number;
  action_badge: 'ACCUMULATE_IN_BUY_ZONE' | 'BUY_ON_DIP' | 'WAIT_FOR_EARNINGS' | 'AVOID_VALUE_TRAP';
  buy_zone_low: number;
  buy_zone_high: number;
  support_anchor: number;
  stop_loss_price: number;
  stop_loss_pct: number;
  atr_stop_raw: number;
  structural_stop_raw: number;
  target_1_3m: number;
  target_1_upside_pct: number;
  target_1_note: string;
  target_2_6m: number;
  target_2_upside_pct: number;
  target_2_note: string;
  reward_to_risk_ratio: number;
  position_sizing: PositionSizingInfo;
  profit_and_friction: ProfitAndFrictionInfo;
  earnings_check: {
    days_until_next_earnings: number | null;
    earnings_warning: boolean;
    earnings_badge: string;
  };
}

export interface CatalystPoint {
  title: string;
  explanation: string;
}

export interface AIDebateReport {
  ticker: string;
  company_name: string;
  generation_mode:
    | 'GEMINI_3_8_FLASH_PRIMARY'
    | 'GEMINI_3_5_FLASH_LITE_FALLBACK'
    | 'DETERMINISTIC_INSTITUTIONAL_SYNTHESIS';
  model_used: string;
  cached_24h: boolean;
  cache_key?: string;
  verdict: 'ACCUMULATE_IN_BUY_ZONE' | 'BUY_ON_DIP' | 'WAIT_FOR_EARNINGS' | 'AVOID_VALUE_TRAP';
  ai_confidence_score: number;
  conviction_score: number;
  plain_english_summary: string;
  bull_case: CatalystPoint[];
  bear_case: CatalystPoint[];
  bull_catalysts: CatalystPoint[];
  bear_risks: CatalystPoint[];
  three_month_outlook: string;
  six_month_outlook: string;
  catalyst_timeline: {
    checkpoint_90d: string;
    checkpoint_180d: string;
  };
  judge_rationale: string;
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  holding_days: number;
  exit_reason: string;
  t1_booked: boolean;
}

export interface BacktestSummary {
  ticker: string;
  market: MarketType;
  period_years: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  avg_return_per_trade_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  strategy_cagr_pct: number;
  buy_and_hold_cagr_pct: number;
  avg_holding_days: number;
  trades: BacktestTrade[];
  equity_curve: { date: string; equity: number }[];
  strategy_rules_summary: string;
}

export interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number;
  ema50: number;
  ema200: number;
}

export interface StockDeepDiveResponse {
  ticker: string;
  company_name: string;
  market: MarketType;
  sector: string;
  industry: string;
  currency_symbol: string;
  current_price: number;
  previous_close: number;
  day_change_pct: number;
  high_52w: number;
  low_52w: number;
  analyst_thermometer: {
    low_52w: number;
    current_price: number;
    high_52w: number;
    target_low: number;
    target_median: number;
    target_mean: number;
    target_high: number;
    analyst_count: number;
    dispersion_ratio: number;
    upside_pct: number;
    discount_from_52w_high_pct: number;
  };
  fundamentals_and_technicals: {
    trailing_pe: number;
    forward_pe: number;
    roe_pct: number;
    roa_pct: number;
    debt_to_equity: number;
    market_cap_cr: number;
    delivery_pct: number;
    volume_surge_ratio: number;
    ema_20: number;
    ema_50: number;
    ema_200: number;
    rsi_14: number;
    atr_14: number;
    swing_low_20d: number;
    rs_20d: number;
    vcp_tightness_ratio: number;
    days_until_earnings: number | null;
  };
  score_breakdown: ScoreBreakdown;
  trade_ticket: TradeTicket;
  ai_debate: AIDebateReport;
  backtest_summary: BacktestSummary;
  ohlcv_history: OHLCVBar[];
  data_source: string;
  updated_at: string;
}

export interface PortfolioAlert {
  type: 'SUCCESS' | 'PROFIT_BOOK' | 'DANGER' | 'ROTATION' | 'HOLD';
  badge: string;
  message: string;
}

export interface PortfolioPosition {
  id: number;
  ticker: string;
  company_name: string;
  market: MarketType;
  currency_symbol: string;
  sector: string;
  owner: 'Saksham' | 'Family' | 'Joint';
  status: 'ACTIVE' | 'WATCHLIST' | 'CLOSED';
  shares: number;
  entry_price: number;
  current_price: number;
  entry_date: string;
  days_held: number;
  stop_loss_price: number;
  target_1_price: number;
  target_2_price: number;
  partial_booked: boolean;
  invested_value: number;
  current_value: number;
  gross_pnl: number;
  net_post_friction_pnl: number;
  pnl_pct: number;
  progress_to_t1_pct: number;
  progress_to_t2_pct: number;
  alerts: PortfolioAlert[];
  notes: string;
}

export interface PortfolioSummaryStats {
  active_positions: number;
  total_invested: number;
  total_current_value: number;
  total_gross_pnl: number;
  total_net_pnl: number;
  total_return_pct: number;
}

export interface PortfolioResponse {
  positions: PortfolioPosition[];
  summary_india_inr: PortfolioSummaryStats;
  summary_us_usd: PortfolioSummaryStats;
}
