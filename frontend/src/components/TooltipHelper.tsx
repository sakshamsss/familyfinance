import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

export const PLAIN_ENGLISH_GLOSSARY: Record<
  string,
  { title: string; plainEnglish: string; formulaNote: string }
> = {
  bargain_score: {
    title: 'Bargain Score (0 to 100)',
    plainEnglish:
      'A single 0–100 quality and value grade combining 6 checks: Analyst Target Upside (25 points), 52W (52-Week) High Discount & P/E (Price-to-Earnings) valuation (20 points), ROE (Return on Equity) & Low Debt safety (20 points), NSE (National Stock Exchange) Delivery Buying (15 points), RSI (Relative Strength Index) & EMA (Exponential Moving Average) Trend (10 points), and RS (Relative Strength) (10 points). Scores of 70+ indicate strong setups.',
    formulaNote:
      '6-factor weighted score that rewards consistent analyst targets and penalizes deep (>45%) structural crashes.',
  },
  consensus_upside: {
    title: 'Consensus Target — 6M (6-Month) Upside %',
    plainEnglish:
      'How much higher institutional research analysts expect the stock price to be in 6 to 12 months compared to today. We use the median target across all covering analysts so a single overly optimistic forecast cannot skew the target.',
    formulaNote:
      'Calculated from Median Analyst Target Price with dispersion check (High - Low) / Median <= 0.50.',
  },
  discount_52w: {
    title: '52W (52-Week) High Sale Discount %',
    plainEnglish:
      'How much cheaper the stock is today compared to its highest price over the last 52 weeks (1 year). Our preferred bargain range is 10% to 38% off—buying strong companies on a temporary dip while avoiding broken stocks down more than 45%.',
    formulaNote:
      '((52-Week High - Current Price) / 52-Week High) * 100, paired with Forward P/E (Price-to-Earnings) check.',
  },
  roe: {
    title: 'ROE (Return on Equity %)',
    plainEnglish:
      'Measures how efficiently a company generates profits from shareholders’ capital. An ROE (Return on Equity) of 15% or higher (or 13%+ for banks) shows a consistently profitable, well-run business.',
    formulaNote: 'Annual Net Profit / Shareholders’ Equity over the trailing 12 months.',
  },
  debt_to_equity: {
    title: 'Quality Shield — ROE (Return on Equity) & D/E (Debt-to-Equity)',
    plainEnglish:
      'Checks both profitability via ROE (Return on Equity) and balance-sheet safety via D/E (Debt-to-Equity Ratio). A D/E (Debt-to-Equity) under 0.8x means low borrowing. For Banks and Financial companies (whose core business is taking deposits), the system automatically checks ROA (Return on Assets >= 1.1%) instead of D/E (Debt-to-Equity).',
    formulaNote:
      'Non-financials: ROE (Return on Equity) >= 13% & D/E (Debt-to-Equity) <= 0.8x. Financials: ROA (Return on Assets) >= 1.1%.',
  },
  delivery_pct: {
    title: 'Delivery & Volume — NSE (National Stock Exchange)',
    plainEnglish:
      'Shows what percentage of traded shares were actually bought and held in investors’ demat accounts rather than flipped intraday. Delivery above 40%–45% alongside rising volume (Volume Surge > 1.2x) indicates steady institutional buying.',
    formulaNote:
      'Delivered Quantity / Total Traded Quantity on NSE (National Stock Exchange) + 5-day vs 20-day up-volume ratio.',
  },
  rsi_14: {
    title: 'RSI (Relative Strength Index) & EMA (Exponential Moving Average) Trend',
    plainEnglish:
      'RSI (Relative Strength Index) is a 0–100 momentum gauge over 14 days. Below 32 means the stock is still falling sharply; above 72 means it is overbought. A reading between 40 and 68 while holding near or above its 20-day EMA (Exponential Moving Average) signals a healthy upward turn.',
    formulaNote:
      '14-day Wilder RSI (Relative Strength Index) paired with Price >= 0.98 * 20-day EMA (Exponential Moving Average).',
  },
  buy_zone: {
    title: 'Ideal Buy Zone',
    plainEnglish:
      'The recommended price range to buy shares without overpaying. It is anchored between the stock’s 20-day EMA (Exponential Moving Average) support and recent 20-day low up to 1% above the current price.',
    formulaNote:
      'Range from min(Price * 0.985, max(20-Day EMA, 20-Day Swing Low)) to Price * 1.01.',
  },
  stop_loss: {
    title: 'Safety Stop-Loss — ATR (Average True Range) Protected',
    plainEnglish:
      'Your predefined exit price if the trade does not work out. Placed below recent support and normal daily price swings using 14-day ATR (Average True Range), capped between -5.5% and -10% so normal daily fluctuations do not trigger an early exit, while preventing any large loss.',
    formulaNote:
      'min(BuyZoneLow - 2.2 * ATR(14), 20-Day Low * 0.985), clamped between -5.5% and -10.0%.',
  },
  target_1_2: {
    title: '3M (3-Month) Target 1 & 6M (6-Month) Target 2 Plan',
    plainEnglish:
      'At Target 1 (~3 months), sell half (50%) of your shares to lock in cash profit and raise your stop-loss on the remaining half to your entry price. That makes the rest of your holding a risk-free ride toward Target 2 (the 6-month median analyst target).',
    formulaNote:
      'Target 1 = Entry + 55% of distance to Median Analyst Target; Target 2 = Median Analyst Target.',
  },
  friction_tax: {
    title: 'Net Profit After STT (Securities Transaction Tax) & Tax Reserve',
    plainEnglish:
      'Your realistic take-home profit after subtracting delivery brokerage and statutory charges—0.1% STT (Securities Transaction Tax) on buy + 0.1% on sell + exchange/stamp fees (~0.25% total)—and setting aside a 12.5% capital gains tax reserve.',
    formulaNote:
      'Deducts 0.25% round-trip transaction friction and 12.5% tax reserve on positive gains.',
  },
  regime_multiplier: {
    title: 'Market Health & Trade Size Multiplier',
    plainEnglish:
      'When the broader market index (Nifty 50 or S&P 500) is in a healthy uptrend (Green), normal 100% (1.0x) position sizing is used. In a sideways market (Amber), trade size automatically scales to 65% (0.65x), and in a market correction (Red) to 35% (0.35x) to protect capital.',
    formulaNote:
      'Evaluates Index vs 50-day & 200-day EMA (Exponential Moving Average), A/D (Advance/Decline) ratio, and VIX (Volatility Index).',
  },
};

interface TooltipHelperProps {
  termKey: keyof typeof PLAIN_ENGLISH_GLOSSARY | string;
  plainEnglishMode?: boolean;
  className?: string;
}

export const TooltipHelper: React.FC<TooltipHelperProps> = ({
  termKey,
  plainEnglishMode = false,
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeBelow: boolean }>({
    top: 0,
    left: 0,
    placeBelow: true,
  });

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const item = PLAIN_ENGLISH_GLOSSARY[termKey];
  const isOpen = hovered || pinned;

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const tooltipWidth = 340;
    const halfWidth = tooltipWidth / 2;
    const centerX = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      halfWidth + 12,
      Math.min(window.innerWidth - halfWidth - 12, centerX)
    );
    // Place below if near the top of the viewport (< 210px), otherwise place above
    const placeBelow = rect.top < 210;
    const top = placeBelow ? rect.bottom + 10 : rect.top - 10;
    setCoords({ top, left: clampedLeft, placeBelow });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [pinned]);

  if (!item) return null;

  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          updatePosition();
          setPinned((prev) => !prev);
        }}
        onMouseEnter={() => {
          updatePosition();
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-all ml-1.5 focus:outline-none ${
          isOpen
            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
            : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
        }`}
        aria-label={`Explain ${item.title}`}
        title={`Click or hover to explain: ${item.title}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.placeBelow
                ? 'translate(-50%, 0)'
                : 'translate(-50%, -100%)',
            }}
            className="fixed z-[9999] w-80 sm:w-[350px] p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-left normal-case tracking-normal font-sans"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="text-sm font-bold text-emerald-400 leading-snug">
                {item.title}
              </div>
              {pinned && (
                <button
                  type="button"
                  onClick={() => setPinned(false)}
                  className="text-slate-400 hover:text-white p-0.5"
                  aria-label="Close explanation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mb-2">
              {item.plainEnglish}
            </p>
            {!plainEnglishMode && (
              <div className="text-xs font-mono text-slate-400 border-t border-slate-800 pt-2">
                Rule: {item.formulaNote}
              </div>
            )}
          </div>,
          document.body
        )}
    </span>
  );
};
