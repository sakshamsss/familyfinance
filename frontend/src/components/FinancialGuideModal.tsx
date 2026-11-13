import React from 'react';
import { X, BookOpen, ShieldCheck, TrendingUp, Activity, Calculator, Sparkles, CheckCircle2 } from 'lucide-react';

interface FinancialGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FinancialGuideModal: React.FC<FinancialGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Key Financial Terms &amp; How FamilyFinance Works
              </h2>
              <p className="text-sm text-slate-300 mt-0.5">
                Plain-English guide to every financial ratio, technical indicator, Trade Plan, and AI (Artificial Intelligence) feature
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Core Financial Quality Ratios (ROE, D/E, ROA) */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">
              1. Balance Sheet &amp; Profitability Ratios — ROE, D/E &amp; ROA
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ROE */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-emerald-400">
                  ROE (Return on Equity)
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Target: &ge; 15%
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                <strong>What it is:</strong> Measures how much net profit a company generates for every ₹100 (or $100) of shareholders&apos; equity invested in the business.
              </p>
              <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <strong>Formula:</strong> Net Annual Profit &divide; Shareholders&apos; Equity. Higher ROE (&ge;15% for industrials/IT, &ge;13% for banks) proves strong pricing power and wealth compounding.
              </p>
            </div>

            {/* D/E */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-cyan-400">
                  D/E (Debt-to-Equity)
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Target: &le; 0.8
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                <strong>What it is:</strong> Compares a company&apos;s total borrowed debt against its own shareholder equity. Shows whether the business is self-funded or heavily indebted.
              </p>
              <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <strong>Formula:</strong> Total Debt &divide; Shareholders&apos; Equity. A D/E of <strong>0.0 to 0.5</strong> means a fortress balance sheet with minimal debt risk during high interest rates.
              </p>
            </div>

            {/* ROA */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-amber-400">
                  ROA (Return on Assets)
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Banks: &ge; 1.1%
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                <strong>What it is:</strong> Measures how much profit a company earns across all its total assets (factories, cash, equipment, or loan book).
              </p>
              <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <strong>Why we use it for Banks:</strong> Banks take customer deposits (counted as debt), so D/E does not apply to banks. Instead, <strong>ROA &ge; 1.1%</strong> confirms clean lending and low bad loans.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Timing Indicators (RSI & EMA20) */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">
              2. Technical Timing Indicators — RSI &amp; EMA20
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RSI */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-cyan-400">
                  RSI (Relative Strength Index — 14-Day)
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Sweet Spot: 40 – 65
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                <strong>What it is:</strong> A momentum gauge from <strong>0 to 100</strong> that measures the speed of buying vs. selling over the last 14 trading days.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <li>• <strong>Below 32 (Oversold / Falling Knife):</strong> Heavy panic selling — our screener blocks entry until selling stops.</li>
                <li>• <strong>40 to 65 (Accumulation Zone):</strong> Ideal entry window where the stock has stabilized and steady buying is underway.</li>
                <li>• <strong>Above 70 (Overbought):</strong> Stock has risen too fast in the short term; wait for a dip before buying.</li>
              </ul>
            </div>

            {/* EMA20 */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-emerald-400">
                  EMA20 (20-Day Exponential Moving Average)
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Rule: Price &ge; EMA20
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-2">
                <strong>What it is:</strong> The average closing price of the stock over the last <strong>20 trading days (~1 month)</strong>, giving higher weight to recent days so it reacts faster to trend turns.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <li>• <strong>EMA20 (20-Day):</strong> Short-term 1-month support anchor used to set your Limit Buy Zone.</li>
                <li>• <strong>EMA50 (50-Day):</strong> Medium-term (~2.5 months) institutional trend line.</li>
                <li>• <strong>EMA200 (200-Day):</strong> Long-term (~1 year) bull/bear dividing line.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 3: What Trade Ticket & AI Do */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Trade Ticket */}
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                3. What Does the Trade Plan (Trade Ticket) Do?
              </h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-3">
              The <strong>Trade Plan (Trade Ticket)</strong> is a deterministic risk-management calculator that turns your <strong>Total Capital</strong> and <strong>Risk %</strong> into a ready-to-use 3–6 month investment plan:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Ideal Buy Zone:</strong> Calculates the exact support range around EMA20 (20-Day Exponential Moving Average) so you never overpay.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Exact Shares to Buy:</strong> Sizes your order so that if the stock hits Stop-Loss, your total portfolio loses at most ~1% (and caps any single stock at 18% of capital).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Hard Safety Stop-Loss:</strong> Sets a strict floor below 20-Day Swing Low &amp; 1.5x ATR (Average True Range) to protect family capital.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>2-Stage Profit Booking (T1 &amp; T2):</strong> Books 50% shares at 3-Month Target 1 (and trails Stop-Loss to entry) while riding 50% to 6-Month Consensus Target 2, showing net profit after brokerage &amp; tax.</span>
              </li>
            </ul>
          </div>

          {/* AI Multi-Agent Debate */}
          <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                4. What Does the AI (Artificial Intelligence) Review Do?
              </h3>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-3">
              Powered by Google&apos;s <strong>Gemini 3.8 Flash</strong> (with automatic fallback to <strong>Gemini 3.5 Flash-Lite</strong> and 24-hour caching), the AI runs a 2-step adversarial committee on every stock:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Call 1 — Bull vs. Bear Debate:</strong> A Bull Analyst builds the 3 strongest upside catalysts while a skeptical Bear Analyst searches for 3 hidden risks, margin pressures, or value traps.</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Call 2 — Family Investment Judge:</strong> Weighs the Bull &amp; Bear arguments against the 6-Factor Bargain Score to issue a final decision (<strong>ACCUMULATE IN BUY ZONE</strong>, <strong>BUY ON DIP</strong>, <strong>WAIT FOR EARNINGS</strong>, or <strong>AVOID</strong>).</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>3-Month &amp; 6-Month Plain-English Outlook:</strong> Explains in clear, everyday language what milestones to watch over the next 90 and 180 days.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer button */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Got It — Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
