import React, { useState } from 'react';
import {
  ShieldCheck,
  Target,
  Scale,
  PlusCircle,
  History,
  CheckCircle2,
  Search,
  RefreshCw,
  Award,
  TrendingUp,
  TrendingDown,
  Clock,
  KeyRound,
} from 'lucide-react';
import {
  StockDeepDiveResponse,
  MarketType,
  AIDebateReport,
} from '../types/api';
import { TooltipHelper } from './TooltipHelper';
import { ScoreRing } from './FunnelScreener';
import { BacktestModal } from './BacktestModal';

interface StockDeepDiveProps {
  data: StockDeepDiveResponse | null;
  loading: boolean;
  market: MarketType;
  plainEnglishMode: boolean;
  onSelectTicker: (ticker: string) => void;
  onAddTicketToPortfolio: (owner: 'Saksham' | 'Family' | 'Joint') => void;
  onRunLiveGemini: (apiKey?: string) => Promise<void>;
  runningAi: boolean;
}

const QUICK_INDIA_TICKERS = [
  'HDFCBANK.NS',
  'ICICIBANK.NS',
  'RELIANCE.NS',
  'INFY.NS',
  'TCS.NS',
  'HAL.NS',
  'BEL.NS',
  'NATCOPHARM.NS',
  'KPITTECH.NS',
  'PFC.NS',
  'FEDERALBNK.NS',
  'SUNPHARMA.NS',
];

const QUICK_US_TICKERS = [
  'NVDA',
  'MSFT',
  'GOOGL',
  'AMZN',
  'META',
  'AAPL',
  'AMD',
  'AVGO',
  'CRM',
  'NFLX',
];

export const StockDeepDive: React.FC<StockDeepDiveProps> = ({
  data,
  loading,
  market,
  plainEnglishMode,
  onSelectTicker,
  onAddTicketToPortfolio,
  onRunLiveGemini,
  runningAi,
}) => {
  const [tickerInput, setTickerInput] = useState('');
  const [ownerChoice, setOwnerChoice] = useState<'Saksham' | 'Family' | 'Joint'>('Joint');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customGeminiKey, setCustomGeminiKey] = useState('');
  const [addedToast, setAddedToast] = useState(false);

  const quickList = market === 'INDIA_NSE' ? QUICK_INDIA_TICKERS : QUICK_US_TICKERS;

  if (loading || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto mb-3" />
        <div className="text-base font-bold text-white">
          Loading Stock Analysis, Trade Plan &amp; AI (Artificial Intelligence) Review...
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Fetching latest prices, fundamentals, and chart levels
        </p>
      </div>
    );
  }

  const currency = data.currency_symbol;
  const ticket = data.trade_ticket;
  const sizing = ticket.position_sizing;
  const pf = ticket.profit_and_friction;
  const thermo = data.analyst_thermometer;
  const sc = data.score_breakdown;
  const ft = data.fundamentals_and_technicals;
  const ai: AIDebateReport = data.ai_debate;
  const bt = data.backtest_summary;

  const getVerdictStyle = (verdict: string) => {
    if (verdict === 'ACCUMULATE_IN_BUY_ZONE') {
      return 'bg-emerald-500 text-slate-950 border-emerald-400';
    }
    if (verdict === 'BUY_ON_DIP') {
      return 'bg-cyan-500 text-slate-950 border-cyan-400';
    }
    if (verdict === 'WAIT_FOR_EARNINGS') {
      return 'bg-amber-500 text-slate-950 border-amber-400';
    }
    return 'bg-rose-500 text-white border-rose-400';
  };

  // Interactive SVG Chart Geometry
  const bars = data.ohlcv_history || [];
  const chartW = 860;
  const chartH = 310;
  const padL = 16;
  const padR = 76;
  const padT = 20;
  const padB = 26;

  const allPrices = [
    ...bars.map((b) => b.high),
    ...bars.map((b) => b.low),
    ticket.target_2_6m,
    ticket.target_1_3m,
    ticket.stop_loss_price,
    ticket.buy_zone_low,
  ].filter((v) => v > 0);

  const minP = Math.min(...allPrices) * 0.975;
  const maxP = Math.max(...allPrices) * 1.025;
  const priceRange = Math.max(1, maxP - minP);

  const toY = (p: number) =>
    padT + (1 - (p - minP) / priceRange) * (chartH - padT - padB);
  const toX = (i: number) =>
    padL + (i / Math.max(1, bars.length - 1)) * (chartW - padL - padR);

  const closeLine = bars.map((b, i) => `${toX(i)},${toY(b.close)}`).join(' ');
  const ema20Line = bars.map((b, i) => `${toX(i)},${toY(b.ema20)}`).join(' ');
  const ema50Line = bars.map((b, i) => `${toX(i)},${toY(b.ema50)}`).join(' ');
  const ema200Line = bars.map((b, i) => `${toX(i)},${toY(b.ema200)}`).join(' ');
  const areaPoints =
    bars.length > 1
      ? `${toX(0)},${chartH - padB} ${closeLine} ${toX(bars.length - 1)},${chartH - padB}`
      : '';

  const yT2 = toY(ticket.target_2_6m);
  const yT1 = toY(ticket.target_1_3m);
  const yBuyHigh = toY(ticket.buy_zone_high);
  const yBuyLow = toY(ticket.buy_zone_low);
  const yStop = toY(ticket.stop_loss_price);

  const activeBar =
    hoverIndex !== null && bars[hoverIndex]
      ? bars[hoverIndex]
      : bars[bars.length - 1];

  // Thermometer bar calculation
  const tMin = Math.min(thermo.low_52w, thermo.target_low, thermo.current_price) * 0.95;
  const tMax = Math.max(thermo.high_52w, thermo.target_high, thermo.target_median) * 1.03;
  const tSpan = Math.max(1, tMax - tMin);
  const pctPos = (val: number) => Math.max(2, Math.min(98, ((val - tMin) / tSpan) * 100));

  return (
    <div className="space-y-6">
      {/* Top Quick Ticker Switcher & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-400 mr-1">
            Popular Stocks:
          </span>
          {quickList.map((sym) => {
            const active = data.ticker === sym;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => onSelectTicker(sym)}
                className={`px-3 py-1.5 rounded-xl text-sm font-mono font-semibold transition-all ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-200 hover:text-white border border-slate-800'
                }`}
              >
                {sym.replace('.NS', '')}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tickerInput.trim()) {
              onSelectTicker(tickerInput.trim().toUpperCase());
              setTickerInput('');
            }
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder={market === 'INDIA_NSE' ? 'Enter symbol (e.g. LT)...' : 'Enter US symbol...'}
              className="pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-56"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
          >
            Load Stock
          </button>
        </form>
      </div>

      {/* =====================================================================
          CARD A — 3 TO 6 MONTH TRADE PLAN
      ===================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <ScoreRing score={sc.total_score} size={62} />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold text-white font-mono">
                  {data.ticker.replace('.NS', '')}
                </h2>
                <span className="text-base font-medium text-slate-300">
                  — {data.company_name}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-200">
                  {data.sector}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-2">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wide border ${getVerdictStyle(
                    ai.verdict
                  )}`}
                >
                  {ai.verdict.replace(/_/g, ' ')}
                </span>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-mono border ${
                    ticket.earnings_check.earnings_warning
                      ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  {ticket.earnings_check.earnings_badge}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Data Source: {data.data_source}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-xs text-slate-400 uppercase">Current Market Price</div>
            <div className="text-3xl font-bold text-white mt-0.5">
              {currency}
              {data.current_price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div
              className={`text-sm font-semibold mt-0.5 ${
                data.day_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {data.day_change_pct >= 0 ? '+' : ''}
              {data.day_change_pct}% Today • -{thermo.discount_from_52w_high_pct}% below 52W (52-Week) High
            </div>
          </div>
        </div>

        {/* 5 Trade Plan Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 my-5">
          {/* 1. Ideal Buy Zone */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30">
            <div className="text-xs font-semibold uppercase text-cyan-400 flex items-center justify-between">
              <span>1. Ideal Buy Zone</span>
              <TooltipHelper termKey="buy_zone" plainEnglishMode={plainEnglishMode} />
            </div>
            <div className="text-lg font-mono font-bold text-white mt-1.5">
              {currency}
              {ticket.buy_zone_low.toLocaleString()} – {currency}
              {ticket.buy_zone_high.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Support: {currency}
              {ticket.support_anchor.toLocaleString()} (20-Day EMA / Low)
            </div>
          </div>

          {/* 2. 3-Month Target 1 (Book 50%) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/30">
            <div className="text-xs font-semibold uppercase text-teal-400 flex items-center justify-between">
              <span>2. 3M (3-Month) Target 1</span>
              <TooltipHelper termKey="target_1_2" plainEnglishMode={plainEnglishMode} />
            </div>
            <div className="text-lg font-mono font-bold text-teal-300 mt-1.5">
              {currency}
              {ticket.target_1_3m.toLocaleString()}{' '}
              <span className="text-sm">(+{ticket.target_1_upside_pct}%)</span>
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Sell {sizing.shares_to_book_at_t1} shares (50%) &amp; move stop to {currency}
              {data.current_price.toLocaleString()}
            </div>
          </div>

          {/* 3. 6-Month Consensus Target 2 */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40">
            <div className="text-xs font-semibold uppercase text-emerald-400 flex items-center justify-between">
              <span>3. 6M (6-Month) Target 2</span>
              <TooltipHelper termKey="consensus_upside" plainEnglishMode={plainEnglishMode} />
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-1.5">
              {currency}
              {ticket.target_2_6m.toLocaleString()}{' '}
              <span className="text-sm">(+{ticket.target_2_upside_pct}%)</span>
            </div>
            <div className="text-xs text-slate-300 mt-1.5">
              Median of {thermo.analyst_count} Analysts • Reward/Risk {ticket.reward_to_risk_ratio}x
            </div>
          </div>

          {/* 4. Safety Stop-Loss */}
          <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/30">
            <div className="text-xs font-semibold uppercase text-rose-400 flex items-center justify-between">
              <span>4. Safety Stop-Loss</span>
              <TooltipHelper termKey="stop_loss" plainEnglishMode={plainEnglishMode} />
            </div>
            <div className="text-lg font-mono font-bold text-rose-400 mt-1.5">
              {currency}
              {ticket.stop_loss_price.toLocaleString()}{' '}
              <span className="text-sm">({ticket.stop_loss_pct}%)</span>
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Protected by 14-Day ATR (Average True Range: {currency}
              {ft.atr_14})
            </div>
          </div>

          {/* 5. Recommended Shares to Buy */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/50">
            <div className="text-xs font-bold uppercase text-emerald-300 flex items-center justify-between">
              <span>5. Shares to Buy</span>
              <TooltipHelper termKey="regime_multiplier" plainEnglishMode={plainEnglishMode} />
            </div>
            <div className="text-lg font-mono font-bold text-white mt-1.5">
              {sizing.recommended_shares} Shares = {currency}
              {sizing.total_investment_amount.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-300 font-mono mt-1.5">
              Max Risk: {sizing.actual_portfolio_risk_pct}% ({currency}
              {sizing.actual_capital_risk_amount.toLocaleString()})
            </div>
          </div>
        </div>

        {/* Bottom Strip: Net-of-Tax Profit + Add to Portfolio */}
        <div className="pt-4 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="text-slate-400">Gross Profit at Target 2: </span>
              <span className="font-mono font-bold text-slate-200">
                +{currency}
                {pf.gross_expected_profit_t2.toLocaleString()}
              </span>
            </div>
            <div className="bg-emerald-950/30 px-3.5 py-2 rounded-xl border border-emerald-500/30 inline-flex flex-wrap items-center gap-1">
              <span className="text-emerald-200">
                Net Profit after STT (Securities Transaction Tax) &amp; 12.5% Tax Reserve:{' '}
              </span>
              <span className="font-mono font-bold text-emerald-400">
                +{currency}
                {pf.net_post_friction_profit_t2.toLocaleString()}
              </span>
              <span className="text-xs text-slate-300 ml-1 font-mono">
                (50/50 Blended Plan: +{currency}
                {pf.net_post_friction_profit_blended.toLocaleString()})
              </span>
              <TooltipHelper termKey="friction_tax" plainEnglishMode={plainEnglishMode} />
            </div>
          </div>

          {/* Add to Portfolio Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={ownerChoice}
              onChange={(e) =>
                setOwnerChoice(e.target.value as 'Saksham' | 'Family' | 'Joint')
              }
              aria-label="Select Account Owner"
              className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Joint">Joint Family Account</option>
              <option value="Family">Family Member Account</option>
              <option value="Saksham">Saksham&apos;s Account</option>
            </select>

            <button
              type="button"
              onClick={() => {
                onAddTicketToPortfolio(ownerChoice);
                setAddedToast(true);
                setTimeout(() => setAddedToast(false), 3000);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 shadow-sm"
            >
              {addedToast ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Added to Family Portfolio!</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Add {sizing.recommended_shares} Shares to Portfolio</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CARD B + CARD C GRID: PRICE CHART + 6-FACTOR SCORECARD
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CARD B: Interactive Price Chart & Analyst Target Range (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Price Chart, Buy Zone &amp; EMA (Exponential Moving Average — 20 / 50 / 200 Days)
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Blue Band = Ideal Buy Zone • Green Line = 6M (6-Month) Target 2 • Teal Line = 3M (3-Month) Target 1 • Red Line = Stop-Loss
                </p>
              </div>
              {activeBar && (
                <div className="text-xs font-mono bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-slate-300">
                  <span className="text-slate-400">{activeBar.time}</span> • Close:{' '}
                  <strong className="text-white">
                    {currency}
                    {activeBar.close}
                  </strong>{' '}
                  • EMA20: <span className="text-cyan-400">{activeBar.ema20}</span> • EMA50:{' '}
                  <span className="text-amber-400">{activeBar.ema50}</span> • EMA200:{' '}
                  <span className="text-purple-400">{activeBar.ema200}</span>
                </div>
              )}
            </div>

            {/* Interactive SVG Chart */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 overflow-hidden">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-64 sm:h-72 select-none cursor-crosshair"
                onMouseLeave={() => setHoverIndex(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = ((e.clientX - rect.left) / rect.width) * chartW;
                  const idx = Math.round(
                    ((relX - padL) / (chartW - padL - padR)) * (bars.length - 1)
                  );
                  if (idx >= 0 && idx < bars.length) setHoverIndex(idx);
                }}
              >
                <defs>
                  <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Shaded Buy Zone Band */}
                <rect
                  x={padL}
                  y={Math.min(yBuyHigh, yBuyLow)}
                  width={chartW - padL - padR}
                  height={Math.max(6, Math.abs(yBuyLow - yBuyHigh))}
                  fill="#06b6d4"
                  fillOpacity={0.14}
                />

                {/* Target 2 Dashed Line (Green) */}
                <line
                  x1={padL}
                  y1={yT2}
                  x2={chartW - padR}
                  y2={yT2}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                <text
                  x={chartW - padR + 4}
                  y={yT2 + 4}
                  fill="#10b981"
                  fontSize="11"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  T2 {ticket.target_2_6m}
                </text>

                {/* Target 1 Dashed Line (Teal) */}
                <line
                  x1={padL}
                  y1={yT1}
                  x2={chartW - padR}
                  y2={yT1}
                  stroke="#14b8a6"
                  strokeWidth={1.3}
                  strokeDasharray="4 4"
                />
                <text
                  x={chartW - padR + 4}
                  y={yT1 + 4}
                  fill="#14b8a6"
                  fontSize="11"
                  fontFamily="JetBrains Mono"
                >
                  T1 {ticket.target_1_3m}
                </text>

                {/* Stop Loss Dashed Line (Rose) */}
                <line
                  x1={padL}
                  y1={yStop}
                  x2={chartW - padR}
                  y2={yStop}
                  stroke="#f43f5e"
                  strokeWidth={1.4}
                  strokeDasharray="5 4"
                />
                <text
                  x={chartW - padR + 4}
                  y={yStop + 4}
                  fill="#f43f5e"
                  fontSize="11"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  Stop {ticket.stop_loss_price}
                </text>

                {/* Area & Moving Averages */}
                {areaPoints && <polygon points={areaPoints} fill="url(#priceAreaGrad)" />}
                {ema200Line && (
                  <polyline
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth={1.2}
                    strokeOpacity={0.7}
                    points={ema200Line}
                  />
                )}
                {ema50Line && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1.3}
                    strokeOpacity={0.8}
                    points={ema50Line}
                  />
                )}
                {ema20Line && (
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={1.4}
                    strokeOpacity={0.9}
                    points={ema20Line}
                  />
                )}
                {closeLine && (
                  <polyline
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth={2.2}
                    points={closeLine}
                  />
                )}

                {/* Hover Crosshair */}
                {hoverIndex !== null && bars[hoverIndex] && (
                  <>
                    <line
                      x1={toX(hoverIndex)}
                      y1={padT}
                      x2={toX(hoverIndex)}
                      y2={chartH - padB}
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={toX(hoverIndex)}
                      cy={toY(bars[hoverIndex].close)}
                      r={4}
                      fill="#10b981"
                      stroke="#020617"
                      strokeWidth={1.5}
                    />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Visual Horizontal Analyst Target Thermometer */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between text-sm mb-2.5">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Analyst Target Range ({thermo.analyst_count} Covering Analysts)</span>
              </span>
              <span className="font-mono text-xs text-slate-400">
                Target Spread: {thermo.dispersion_ratio} (
                {thermo.dispersion_ratio <= 0.5 ? 'Strong Agreement' : 'Wide Spread'})
              </span>
            </div>

            <div className="relative h-9 bg-slate-950 rounded-xl border border-slate-800 px-3 flex items-center">
              <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-rose-500/40 via-cyan-500/40 to-emerald-500/60" />

              {/* 52W Low Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${pctPos(thermo.low_52w)}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-950" />
              </div>

              {/* Current Price Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
                style={{ left: `${pctPos(thermo.current_price)}%` }}
              >
                <div className="w-4 h-4 rounded-full bg-white border-2 border-cyan-400 shadow" />
              </div>

              {/* 52W High Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${pctPos(thermo.high_52w)}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-amber-400 border border-slate-950" />
              </div>

              {/* Median Target Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-20"
                style={{ left: `${pctPos(thermo.target_median)}%` }}
              >
                <div className="w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-lg" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2.5 text-xs font-mono">
              <div>
                <span className="text-slate-400 block">52W (52-Week) Low</span>
                <span className="text-slate-200 font-semibold">
                  {currency}
                  {thermo.low_52w.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-cyan-400 block">● Current Price</span>
                <span className="text-white font-bold">
                  {currency}
                  {thermo.current_price.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-amber-400 block">● 52W (52-Week) High</span>
                <span className="text-amber-300 font-semibold">
                  {currency}
                  {thermo.high_52w.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-emerald-400 block">● Median Target</span>
                <span className="text-emerald-400 font-bold">
                  {currency}
                  {thermo.target_median.toLocaleString()} (+{thermo.upside_pct}%)
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-slate-400 block">Highest Target</span>
                <span className="text-slate-200 font-semibold">
                  {currency}
                  {thermo.target_high.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD C: 6-Factor Financial Health Scorecard (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  6-Factor Quality &amp; Value Score
                </h3>
                <p className="text-sm text-slate-400">
                  100-Point Fundamental &amp; Technical Breakdown
                </p>
              </div>
              <span className="text-xl font-mono font-bold text-emerald-400">
                {sc.total_score}/100
              </span>
            </div>

            <div className="space-y-4 mt-4">
              {/* Factor 1 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    1. Analyst Target Upside (+{sc.upside_pct}%)
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {sc.factor1_upside_pts} / 25
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(sc.factor1_upside_pts / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Factor 2 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    2. 52W (52-Week) Discount (-{sc.discount_52w_pct}%) &amp; P/E
                  </span>
                  <span className="font-mono font-bold text-cyan-400">
                    {sc.factor2_bargain_pts} / 20
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${(sc.factor2_bargain_pts / 20) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Trailing P/E (Price-to-Earnings): {ft.trailing_pe}x &rarr; Forward P/E: {ft.forward_pe}x
                </div>
              </div>

              {/* Factor 3 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    3. {sc.is_financial ? 'Bank ROE & ROA Safety' : 'ROE & Low-Debt Safety'}
                  </span>
                  <span className="font-mono font-bold text-teal-400">
                    {sc.factor3_quality_pts} / 20
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full"
                    style={{ width: `${(sc.factor3_quality_pts / 20) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  {sc.is_financial
                    ? `ROE (Return on Equity): ${ft.roe_pct}% • ROA (Return on Assets): ${ft.roa_pct}%`
                    : `ROE (Return on Equity): ${ft.roe_pct}% • D/E (Debt-to-Equity): ${ft.debt_to_equity}x`}
                </div>
              </div>

              {/* Factor 4 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    4. NSE (National Stock Exchange) Delivery ({ft.delivery_pct}%)
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {sc.factor4_inst_pts} / 15
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${(sc.factor4_inst_pts / 15) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Up-Day Volume Surge: {ft.volume_surge_ratio}x
                </div>
              </div>

              {/* Factor 5 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    5. RSI (Relative Strength Index: {ft.rsi_14}) Trend
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {sc.factor5_timing_pts} / 10
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${(sc.factor5_timing_pts / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Factor 6 */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    6. RS (Relative Strength: {ft.rs_20d >= 0 ? '+' : ''}
                    {ft.rs_20d}%) &amp; VCP (Volatility Contraction Pattern)
                  </span>
                  <span className="font-mono font-bold text-cyan-400">
                    {sc.factor6_rs_vcp_pts} / 10
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${(sc.factor6_rs_vcp_pts / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
            All financial figures and scores are calculated directly from market data.
          </div>
        </div>
      </div>

      {/* =====================================================================
          CARD D — AI INVESTMENT REVIEW (BULL CASE VS BEAR CASE)
      ===================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-white">
                  AI (Artificial Intelligence) Bull vs. Bear Stock Review
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Model: {ai.model_used || 'gemini-3.8-flash'}
                </span>
                {ai.cached_24h && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    24h Cached Report
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Balanced look at reasons to buy (Bull Case), potential risks (Bear Case), and overall recommendation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-sm font-medium flex items-center gap-1.5"
              title="Set optional Gemini API (Application Programming Interface) Key"
            >
              <KeyRound className="w-4 h-4" />
              <span>API Key</span>
            </button>
            <button
              type="button"
              disabled={runningAi}
              onClick={() => onRunLiveGemini(customGeminiKey || undefined)}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${runningAi ? 'animate-spin' : ''}`} />
              <span>
                {runningAi
                  ? 'Refreshing AI Review...'
                  : 'Refresh AI Analysis'}
              </span>
            </button>
          </div>
        </div>

        {/* Plain-English Summary Box */}
        <div className="my-5 p-5 rounded-xl bg-slate-950 border border-emerald-500/40">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-sm font-bold text-emerald-400">
              Plain-English Investment Summary
            </span>
            <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Confidence Score: {ai.conviction_score} / 100
            </span>
          </div>
          <p className="text-base text-slate-100 leading-relaxed">
            {ai.plain_english_summary}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800 text-sm font-mono text-slate-300">
            {ai.judge_rationale}
          </div>
        </div>

        {/* Side-by-Side Bull vs Bear Debate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Bull Case */}
          <div className="p-5 rounded-xl bg-emerald-950/15 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 mb-3.5">
              <TrendingUp className="w-5 h-5" />
              <span>Reasons to Buy (Bull Case Catalysts)</span>
            </div>
            <div className="space-y-3">
              {ai.bull_catalysts.map((pt, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-sm font-bold text-emerald-300 mb-1">
                    {i + 1}. {pt.title}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{pt.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bear Case */}
          <div className="p-5 rounded-xl bg-rose-950/15 border border-rose-500/30">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-400 mb-3.5">
              <TrendingDown className="w-5 h-5" />
              <span>Key Risks to Watch (Bear Case Audit)</span>
            </div>
            <div className="space-y-3">
              {ai.bear_risks.map((pt, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-sm font-bold text-rose-300 mb-1">
                    {i + 1}. {pt.title}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{pt.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 90-Day & 180-Day Checkpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <Clock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-teal-400">
                90-Day Plan — 3M (3-Month) Target 1
              </div>
              <p className="text-sm text-slate-200 mt-1 leading-relaxed">
                {ai.catalyst_timeline.checkpoint_90d}
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-emerald-400">
                180-Day Plan — 6M (6-Month) Target 2
              </div>
              <p className="text-sm text-slate-200 mt-1 leading-relaxed">
                {ai.catalyst_timeline.checkpoint_180d}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CARD E — 3-YEAR HISTORICAL STRATEGY BACKTEST STRIP
      ===================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              3-Year Past Performance Test ({data.ticker.replace('.NS', '')})
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              How buying {data.company_name} on past 20-Day EMA (Exponential Moving Average) + RSI (Relative Strength Index 40–65) setups performed over {bt.period_years} years
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 block">Win Rate</span>
            <span className="text-base font-mono font-bold text-emerald-400">
              {bt.win_rate_pct}% ({bt.winning_trades}/{bt.total_trades})
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 block">Avg Return / Trade</span>
            <span className="text-base font-mono font-bold text-teal-400">
              +{bt.avg_return_per_trade_pct}%
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 block">Profit Factor</span>
            <span className="text-base font-mono font-bold text-white">
              {bt.profit_factor}x
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 block">Avg Hold Time</span>
            <span className="text-base font-mono font-bold text-cyan-400">
              {bt.avg_holding_days} Days
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBacktestModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/40 text-sm font-bold text-emerald-400 flex items-center gap-2 transition-colors"
          >
            <Award className="w-4 h-4" />
            <span>View 3-Year Trade History</span>
          </button>
        </div>
      </div>

      {/* Backtest Modal */}
      <BacktestModal
        backtest={bt}
        currency={currency}
        isOpen={showBacktestModal}
        onClose={() => setShowBacktestModal(false)}
      />

      {/* Optional Gemini Key Modal */}
      {showKeyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1.5">
              Gemini 3.8 Flash API (Application Programming Interface) Key
            </h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              FamilyFinance uses Google AI Studio Free Tier (<code className="text-emerald-400">gemini-3.8-flash</code> with automatic <code className="text-cyan-400">gemini-3.5-flash-lite</code> fallback and 24-hour database caching). Enter your <code className="text-emerald-400">GEMINI_API_KEY</code> below to run live AI synthesis.
            </p>
            <input
              type="password"
              value={customGeminiKey}
              onChange={(e) => setCustomGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white mb-4 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowKeyModal(false);
                  onRunLiveGemini(customGeminiKey || undefined);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                Save &amp; Run AI Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
