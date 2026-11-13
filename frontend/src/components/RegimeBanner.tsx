import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, Info, X } from 'lucide-react';
import { RegimeInfo } from '../types/api';
import { TooltipHelper } from './TooltipHelper';

interface RegimeBannerProps {
  regime: RegimeInfo | null;
  plainEnglishMode: boolean;
  showModal: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const RegimeBanner: React.FC<RegimeBannerProps> = ({
  regime,
  plainEnglishMode,
  showModal,
  onCloseModal,
  onOpenModal,
}) => {
  if (!regime) return null;

  const isGreen = regime.regime === 'GREEN_BULL';
  const isAmber = regime.regime === 'AMBER_CAUTION';

  const borderClass = isGreen
    ? 'border-emerald-500/30 bg-slate-900'
    : isAmber
    ? 'border-amber-500/30 bg-slate-900'
    : 'border-rose-500/30 bg-slate-900';

  const accentText = isGreen
    ? 'text-emerald-400'
    : isAmber
    ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <>
      <div className={`rounded-2xl border p-4 mb-6 transition-all ${borderClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                isGreen
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : isAmber
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {isGreen ? (
                <ShieldCheck className="w-6 h-6" />
              ) : isAmber ? (
                <Activity className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`text-base font-bold ${accentText}`}>
                  {regime.label}
                </span>
                <span className="text-sm font-mono px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 inline-flex items-center">
                  Recommended Trade Size: <strong className="ml-1">{(regime.sizing_multiplier * 100).toFixed(0)}%</strong>
                  <TooltipHelper termKey="regime_multiplier" plainEnglishMode={plainEnglishMode} />
                </span>
              </div>
              <div className="text-sm text-slate-300 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                <span>
                  50-Day EMA (Exponential Moving Average): {regime.ema_50.toLocaleString()} (
                  {regime.pct_vs_50_ema >= 0 ? '+' : ''}
                  {regime.pct_vs_50_ema}%)
                </span>
                <span>•</span>
                <span>
                  200-Day EMA (Exponential Moving Average): {regime.ema_200.toLocaleString()} (
                  {regime.pct_vs_200_ema >= 0 ? '+' : ''}
                  {regime.pct_vs_200_ema}%)
                </span>
                <span>•</span>
                <span>
                  A/D (Advance/Decline Ratio): {regime.ad_ratio}x
                </span>
                <span>•</span>
                <span>
                  VIX (Volatility Index): {regime.vix_level}
                </span>
              </div>
              <p className="text-sm text-slate-200 mt-2 leading-relaxed">
                {regime.plain_english_summary}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenModal}
            className="self-start lg:self-center shrink-0 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 flex items-center gap-2 transition-colors"
          >
            <Info className="w-4 h-4 text-emerald-400" />
            <span>View Market Health Details</span>
          </button>
        </div>
      </div>

      {/* Detailed Market Health Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={onCloseModal}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase text-emerald-400">
                  Market Health &amp; Position Sizing Guide
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{regime.label}</h3>
              </div>
              <button
                type="button"
                onClick={onCloseModal}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-sm font-bold text-emerald-400 mb-1">
                What This Means For Our Family Portfolio
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {regime.plain_english_summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">{regime.benchmark_name} Index</div>
                <div className="text-base font-mono font-bold text-white mt-1">
                  {regime.index_level.toLocaleString()}
                </div>
                <div
                  className={`text-sm font-mono mt-0.5 ${
                    regime.day_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {regime.day_change_pct >= 0 ? '+' : ''}
                  {regime.day_change_pct}% today
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">
                  Distance vs 50 / 200 EMA (Exponential Moving Average)
                </div>
                <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                  50-Day: {regime.pct_vs_50_ema >= 0 ? '+' : ''}
                  {regime.pct_vs_50_ema}%
                </div>
                <div className="text-sm font-mono text-slate-300 mt-0.5">
                  200-Day: {regime.pct_vs_200_ema >= 0 ? '+' : ''}
                  {regime.pct_vs_200_ema}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">
                  A/D (Advance/Decline Ratio) Breadth
                </div>
                <div className="text-base font-mono font-bold text-white mt-1">
                  {regime.ad_ratio}x
                </div>
                <div className="text-sm font-mono text-slate-300 mt-0.5">
                  {regime.advances} Advancing / {regime.declines} Declining
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">
                  Trade Size Multiplier &amp; VIX (Volatility Index)
                </div>
                <div className={`text-base font-mono font-bold mt-1 ${accentText}`}>
                  {(regime.sizing_multiplier * 100).toFixed(0)}% ({regime.sizing_multiplier}x)
                </div>
                <div className="text-sm font-mono text-slate-300 mt-0.5">
                  VIX (Volatility Index): {regime.vix_level}
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <div className="text-sm font-semibold text-slate-200">
                Market Health Signals:
              </div>
              {regime.reasons.map((r, i) => (
                <div
                  key={i}
                  className="text-sm text-slate-200 flex items-center gap-2.5 bg-slate-950 px-3.5 py-2.5 rounded-lg border border-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-sm text-slate-400">
              <span>Data Source: {regime.source}</span>
              <button
                type="button"
                onClick={onCloseModal}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
