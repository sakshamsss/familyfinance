import React from 'react';
import { X, Award, TrendingUp, Clock, ShieldAlert } from 'lucide-react';
import { BacktestSummary } from '../types/api';

interface BacktestModalProps {
  backtest: BacktestSummary | null;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
}

export const BacktestModal: React.FC<BacktestModalProps> = ({
  backtest,
  currency,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !backtest) return null;

  const curve = backtest.equity_curve || [];
  const minEq = Math.min(...curve.map((p) => p.equity), 95);
  const maxEq = Math.max(...curve.map((p) => p.equity), 115);
  const span = Math.max(1, maxEq - minEq);

  const svgWidth = 640;
  const svgHeight = 160;
  const points = curve
    .map((pt, i) => {
      const x = (i / Math.max(1, curve.length - 1)) * (svgWidth - 40) + 20;
      const y = svgHeight - 20 - ((pt.equity - minEq) / span) * (svgHeight - 40);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold uppercase text-emerald-400">
              3-Year Historical Strategy Test
            </span>
            <h3 className="text-xl font-bold text-white mt-0.5">
              {backtest.ticker} — Past Setup Performance ({backtest.period_years} Years)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close backtest modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-4">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Win Rate</span>
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
              {backtest.win_rate_pct}%
            </div>
            <div className="text-xs text-slate-400 font-mono">
              {backtest.winning_trades} Wins / {backtest.losing_trades} Losses
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
              <span>Profit Factor</span>
            </div>
            <div className="text-lg font-mono font-bold text-teal-400 mt-1">
              {backtest.profit_factor}x
            </div>
            <div className="text-xs text-slate-400 font-mono">Total Gain / Loss</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400">Avg Trade Return</div>
            <div
              className={`text-lg font-mono font-bold mt-1 ${
                backtest.avg_return_per_trade_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {backtest.avg_return_per_trade_pct >= 0 ? '+' : ''}
              {backtest.avg_return_per_trade_pct}%
            </div>
            <div className="text-xs text-slate-400 font-mono">After 0.25% fees</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Max Drawdown</span>
            </div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-1">
              -{backtest.max_drawdown_pct}%
            </div>
            <div className="text-xs text-slate-400 font-mono">
              CAGR (Compound Annual Growth Rate): {backtest.strategy_cagr_pct}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Avg Hold Time</span>
            </div>
            <div className="text-lg font-mono font-bold text-white mt-1">
              {backtest.avg_holding_days} Days
            </div>
            <div className="text-xs text-slate-400 font-mono">3–6 Month Horizon</div>
          </div>
        </div>

        {/* Equity Curve */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-4">
          <div className="flex flex-wrap items-center justify-between text-sm mb-2">
            <span className="font-semibold text-slate-200">
              Compounded Strategy Growth Curve (Starting at 100.0)
            </span>
            <span className="font-mono text-emerald-400 text-xs">
              Strategy CAGR (Compound Annual Growth Rate): {backtest.strategy_cagr_pct}% vs Buy &amp; Hold: {backtest.buy_and_hold_cagr_pct}%
            </span>
          </div>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-36">
            <line
              x1={20}
              y1={svgHeight - 20}
              x2={svgWidth - 20}
              y2={svgHeight - 20}
              stroke="#1e293b"
              strokeWidth={1}
            />
            {points && (
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                points={points}
              />
            )}
          </svg>
          <p className="text-xs text-slate-400 mt-1">{backtest.strategy_rules_summary}</p>
        </div>

        {/* Trade History Table */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950 text-xs font-semibold uppercase text-slate-300 border-b border-slate-800">
                <th className="py-3 px-3.5">Entry Date</th>
                <th className="py-3 px-3.5">Exit Date</th>
                <th className="py-3 px-3.5 text-right">Entry Price</th>
                <th className="py-3 px-3.5 text-right">Exit Price</th>
                <th className="py-3 px-3.5 text-right">Hold Days</th>
                <th className="py-3 px-3.5 text-right">Net Return</th>
                <th className="py-3 px-3.5">Exit Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {backtest.trades.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3.5 text-slate-200">{t.entry_date}</td>
                  <td className="py-2.5 px-3.5 text-slate-200">{t.exit_date}</td>
                  <td className="py-2.5 px-3.5 text-right text-slate-200">
                    {currency}
                    {t.entry_price.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-slate-200">
                    {currency}
                    {t.exit_price.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-slate-300">{t.holding_days}d</td>
                  <td
                    className={`py-2.5 px-3.5 text-right font-bold ${
                      t.return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {t.return_pct >= 0 ? '+' : ''}
                    {t.return_pct}%
                  </td>
                  <td className="py-2.5 px-3.5 text-xs text-slate-300">{t.exit_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
