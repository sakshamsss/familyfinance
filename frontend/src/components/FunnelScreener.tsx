import React, { useState } from 'react';
import {
  Filter,
  ArrowRight,
  Search,
  BarChart3,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import {
  ScreenerFilterParams,
  ScreenerResponse,
  ScreenerCandidate,
  CapFilterType,
} from '../types/api';
import { TooltipHelper } from './TooltipHelper';

interface FunnelScreenerProps {
  filters: ScreenerFilterParams;
  onUpdateFilters: (next: Partial<ScreenerFilterParams>) => void;
  onResetFilters: () => void;
  screenerData: ScreenerResponse | null;
  loading: boolean;
  plainEnglishMode: boolean;
  onSelectStockForDeepDive: (ticker: string) => void;
  onQuickAddPosition: (candidate: ScreenerCandidate) => void;
  onOpenGuideModal?: () => void;
}

export const ScoreRing: React.FC<{ score: number; size?: number }> = ({
  score,
  size = 50,
}) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped >= 75
      ? '#10b981'
      : clamped >= 60
      ? '#14b8a6'
      : clamped >= 48
      ? '#f59e0b'
      : '#f43f5e';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          className="text-slate-800"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-mono font-bold text-white">
        {Math.round(clamped)}
      </span>
    </div>
  );
};

export const FunnelScreener: React.FC<FunnelScreenerProps> = ({
  filters,
  onUpdateFilters,
  onResetFilters,
  screenerData,
  loading,
  plainEnglishMode,
  onSelectStockForDeepDive,
  onQuickAddPosition,
  onOpenGuideModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSliders, setShowSliders] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(60);

  const isIndia = filters.market === 'INDIA_NSE';
  const currency = isIndia ? '₹' : '$';
  const activeCapFilter: CapFilterType = filters.cap_filter || 'ALL';

  const capCounts = screenerData?.cap_counts || {
    ALL: isIndia ? 650 : 250,
    LARGE_AND_MID: isIndia ? 500 : 200,
    LARGE_CAP: 100,
    MID_CAP: isIndia ? 400 : 100,
    SMALL_CAP: isIndia ? 150 : 50,
  };

  const counts = screenerData?.funnel_counts || {
    universe_count: capCounts[activeCapFilter] || (isIndia ? 650 : 250),
    stage1_bargain_count: 0,
    stage2_quality_count: 0,
    stage3_timing_count: 0,
  };

  const getUniverseDescription = () => {
    if (isIndia) {
      if (activeCapFilter === 'LARGE_AND_MID') {
        return 'All 500 Nifty 500 Institutional Large & Mid-Caps';
      }
      if (activeCapFilter === 'LARGE_CAP') {
        return 'Top 100 Nifty 100 Institutional Large-Caps';
      }
      if (activeCapFilter === 'MID_CAP') {
        return 'All 400 Nifty 500 Institutional Mid-Caps';
      }
      if (activeCapFilter === 'SMALL_CAP') {
        return 'Top 150 Nifty Smallcap 250 Liquid Companies';
      }
      return 'All 650 NSE Stocks (500 Large & Mid-Cap + 150 Small-Cap)';
    } else {
      if (activeCapFilter === 'LARGE_AND_MID') {
        return 'Top 200 US NYSE/NASDAQ Large & Mid-Cap Compounders';
      }
      if (activeCapFilter === 'LARGE_CAP') {
        return 'Top 100 US S&P 500 & NASDAQ-100 Large-Caps';
      }
      if (activeCapFilter === 'MID_CAP') {
        return 'Top 100 US S&P MidCap 400 Growth Compounders';
      }
      if (activeCapFilter === 'SMALL_CAP') {
        return 'Top 50 US Russell 2000 & S&P SmallCap 600 Leaders';
      }
      return 'All 250 US NYSE/NASDAQ Stocks (Large, Mid & Small-Cap)';
    }
  };

  const getCapBadgeStyle = (capCategory?: string) => {
    if (capCategory === 'LARGE_CAP') {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (capCategory === 'MID_CAP') {
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  };

  const allCandidates = (screenerData?.candidates || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.ticker.toLowerCase().includes(q) ||
      c.company_name.toLowerCase().includes(q) ||
      c.sector.toLowerCase().includes(q) ||
      (c.industry || '').toLowerCase().includes(q) ||
      (c.cap_label || '').toLowerCase().includes(q)
    );
  });

  const displayedCandidates = allCandidates.slice(0, visibleLimit);
  const sectors = screenerData?.available_sectors || ['ALL'];

  const handleFullReset = () => {
    setSearchQuery('');
    setVisibleLimit(60);
    onResetFilters();
  };

  const capOptions: { id: CapFilterType; label: string; count: number }[] = [
    {
      id: 'ALL',
      label: isIndia ? 'All NSE Stocks (Large, Mid & Small)' : 'All US Stocks (Large, Mid & Small)',
      count: capCounts.ALL,
    },
    {
      id: 'LARGE_AND_MID',
      label: isIndia ? 'All 500 Large & Mid-Cap (Nifty 500)' : 'All 200 Large & Mid-Cap',
      count: capCounts.LARGE_AND_MID,
    },
    {
      id: 'LARGE_CAP',
      label: 'Large-Cap Only',
      count: capCounts.LARGE_CAP,
    },
    {
      id: 'MID_CAP',
      label: 'Mid-Cap Only',
      count: capCounts.MID_CAP,
    },
    {
      id: 'SMALL_CAP',
      label: 'Small-Cap Only',
      count: capCounts.SMALL_CAP,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. MARKET CAP SEGMENT SELECTOR + 4-STEP SCREENING SUMMARY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-lg font-bold text-white">
              4-Step Stock Filtering Funnel
            </h2>
            <TooltipHelper termKey="bargain_score" plainEnglishMode={plainEnglishMode} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenGuideModal && (
              <button
                type="button"
                onClick={onOpenGuideModal}
                className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 hover:border-cyan-500/50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>What is ROE, D/E, ROA, RSI, EMA20, Trade Plan &amp; AI?</span>
              </button>
            )}
          </div>
        </div>

        {/* Market Cap Segment Filter Tabs */}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Market Capitalization Segment to Scan:
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Market Cap Filter">
            {capOptions.map((opt) => {
              const isSelected = activeCapFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setVisibleLimit(60);
                    onUpdateFilters({ cap_filter: opt.id });
                  }}
                  className={`h-10 px-3.5 rounded-xl text-sm font-semibold border transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                      isSelected
                        ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-emerald-400'
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {plainEnglishMode && (
          <div className="mb-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 leading-relaxed">
            <strong>How This Filter Works:</strong> We scan{' '}
            <strong>{counts.universe_count} liquid stocks</strong> ({getUniverseDescription()}), narrow down to companies trading on sale with at least{' '}
            <strong>+{filters.min_upside_pct}% consensus analyst upside</strong>, verify strong balance-sheet quality via{' '}
            <strong>ROE (Return on Equity &ge; {filters.min_roe_pct}%) and low D/E (Debt-to-Equity &le; {filters.max_debt_to_equity}x)</strong> (using{' '}
            <strong>ROA (Return on Assets &ge; 1.1%)</strong> for banks), and rank the{' '}
            <strong>{counts.stage3_timing_count} stocks</strong> seeing steady institutional buying right now.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {/* Step 1 */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-200">
                Step 1 • Market Universe
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500 hidden lg:block" />
            </div>
            <div className="my-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-mono font-bold text-white">
                {counts.universe_count}
              </span>
              <span className="text-sm text-slate-300 font-medium">
                Liquid Stocks Scanned
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {getUniverseDescription()}
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300">
                Step 2 • Discount &amp; Target
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500 hidden lg:block" />
            </div>
            <div className="my-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-mono font-bold text-cyan-400">
                {counts.stage1_bargain_count}
              </span>
              <span className="text-sm text-slate-300 font-medium">
                Have &ge;+{filters.min_upside_pct}% Target Upside
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {filters.min_discount_52w_pct}%–{filters.max_discount_52w_pct}% below 52W (52-Week) High
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-teal-500/15 text-teal-300">
                Step 3 • Financial Quality
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500 hidden lg:block" />
            </div>
            <div className="my-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-mono font-bold text-teal-400">
                {counts.stage2_quality_count}
              </span>
              <span className="text-sm text-slate-300 font-medium">
                Pass Quality Shield
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              ROE (Return on Equity) &ge;{filters.min_roe_pct}% &amp; D/E (Debt-to-Equity) &le;{filters.max_debt_to_equity}x
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-500 text-slate-950">
                Step 4 • Ready to Review
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="my-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-mono font-bold text-emerald-400">
                {counts.stage3_timing_count}
              </span>
              <span className="text-sm text-emerald-200 font-medium">
                High-Conviction Bargains
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Delivery &ge;{filters.min_delivery_pct}% &amp; RSI (Relative Strength Index) {filters.min_rsi}–{filters.max_rsi}
            </p>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS & SECTOR BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="text-base font-bold text-white">
              Customize Screening Filters
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleFullReset}
              className="h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-medium text-slate-300 hover:text-white hover:border-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset Filters</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSliders(!showSliders)}
              className="h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-medium text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Filter className="w-4 h-4 shrink-0" />
              <span>{showSliders ? 'Hide Filter Sliders' : 'Show Filter Sliders'}</span>
            </button>
          </div>
        </div>

        {showSliders && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 pb-5 border-b border-slate-800">
            {/* Slider 1: Min Analyst Upside */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  Min Analyst Target Upside
                  <TooltipHelper termKey="consensus_upside" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  +{filters.min_upside_pct}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={35}
                step={1}
                value={filters.min_upside_pct}
                onChange={(e) => onUpdateFilters({ min_upside_pct: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>5%</span>
                <span>Preferred: 18%–25%</span>
                <span>35%</span>
              </div>
            </div>

            {/* Slider 2: Min 52W Discount */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  52W (52-Week) High Discount
                  <TooltipHelper termKey="discount_52w" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-cyan-400">
                  {filters.min_discount_52w_pct}%–{filters.max_discount_52w_pct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={filters.min_discount_52w_pct}
                onChange={(e) => onUpdateFilters({ min_discount_52w_pct: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>0%</span>
                <span>Bargain Zone &ge;10%</span>
                <span>30%</span>
              </div>
            </div>

            {/* Slider 3: Min ROE % */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  Min ROE (Return on Equity)
                  <TooltipHelper termKey="roe" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-teal-400">{filters.min_roe_pct}%</span>
              </div>
              <input
                type="range"
                min={8}
                max={25}
                step={1}
                value={filters.min_roe_pct}
                onChange={(e) => onUpdateFilters({ min_roe_pct: Number(e.target.value) })}
                className="w-full accent-teal-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>8%</span>
                <span>Quality &ge;15%</span>
                <span>25%</span>
              </div>
            </div>

            {/* Slider 4: Max Debt-to-Equity */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  Max D/E (Debt-to-Equity)
                  <TooltipHelper termKey="debt_to_equity" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {filters.max_debt_to_equity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.1}
                value={filters.max_debt_to_equity}
                onChange={(e) => onUpdateFilters({ max_debt_to_equity: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>0.1x</span>
                <span>Banks Checked via ROA (Return on Assets)</span>
                <span>1.5x</span>
              </div>
            </div>

            {/* Slider 5: Min Institutional Delivery % */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  Min NSE (National Stock Exchange) Delivery %
                  <TooltipHelper termKey="delivery_pct" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {filters.min_delivery_pct}%
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={60}
                step={1}
                value={filters.min_delivery_pct}
                onChange={(e) => onUpdateFilters({ min_delivery_pct: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>25%</span>
                <span>Strong Buying &ge;45%</span>
                <span>60%</span>
              </div>
            </div>

            {/* Slider 6: Family Risk Per Trade % */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-200 font-medium inline-flex items-center">
                  Max Risk Per Trade %
                  <TooltipHelper termKey="stop_loss" plainEnglishMode={plainEnglishMode} />
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {filters.risk_pct.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.25}
                value={filters.risk_pct}
                onChange={(e) => onUpdateFilters({ risk_pct: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                <span>0.50% (Conservative)</span>
                <span>1.00%</span>
                <span>2.00%</span>
              </div>
            </div>
          </div>
        )}

        {/* Sector Filter Pills & Quick Search */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {sectors.map((sec) => {
              const active = filters.sector_filter === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateFilters({ sector_filter: sec })}
                  className={`h-9 px-3 rounded-xl text-sm font-medium transition-all inline-flex items-center whitespace-nowrap ${
                    active
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {sec === 'ALL' ? 'All Sectors' : sec}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company, sector, or cap..."
              className="h-10 w-full pl-10 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 3. RANKED STOCKS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2.5">
              <span>Top Ranked Stocks Matching Your Criteria</span>
              <span className="px-2.5 py-0.5 rounded-full text-sm font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {allCandidates.length} Matching of {counts.universe_count} Scanned
              </span>
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Sorted by Bargain Score (0–100). Click any stock row or &ldquo;View Trade Plan&rdquo; to inspect its Trade Ticket (Trade Plan) &amp; AI (Artificial Intelligence) Bull vs. Bear Review.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-base text-slate-300">
            Scanning {counts.universe_count} stocks across your criteria...
          </div>
        ) : allCandidates.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-9 h-9 text-amber-400 mx-auto mb-2.5" />
            <div className="text-base font-bold text-white mb-1">
              No stocks matched this combination of filters
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Try lowering the Min Analyst Target Upside or Min Delivery % slider, or reset all filters to default.
            </p>
            <button
              type="button"
              onClick={handleFullReset}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-semibold uppercase text-slate-300">
                    <th className="py-3.5 px-4 whitespace-nowrap">Rank &amp; Stock</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">Sector &amp; Cap</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">Current Price</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end">
                        <span>52W (52-Week) High Sale</span>
                        <TooltipHelper termKey="discount_52w" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end">
                        <span>Consensus Target (6M)</span>
                        <TooltipHelper termKey="consensus_upside" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end">
                        <span>Quality Shield</span>
                        <TooltipHelper termKey="debt_to_equity" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end">
                        <span>Delivery &amp; Vol</span>
                        <TooltipHelper termKey="delivery_pct" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center">
                        <span>RSI / EMA20 Trend</span>
                        <TooltipHelper termKey="rsi_14" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center">
                        <span>Bargain Score</span>
                        <TooltipHelper termKey="bargain_score" plainEnglishMode={plainEnglishMode} />
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">
                  {displayedCandidates.map((c, idx) => {
                    const isFin = c.score_breakdown.is_financial;
                    return (
                      <tr
                        key={c.ticker}
                        onClick={() => onSelectStockForDeepDive(c.ticker)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        {/* Rank & Ticker */}
                        <td className="py-4 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs font-bold text-slate-300 flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-mono text-base font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2 flex-wrap">
                                <span>{c.ticker.replace('.NS', '')}</span>
                                {c.cap_label && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold border ${getCapBadgeStyle(
                                      c.cap_category
                                    )}`}
                                  >
                                    {c.cap_label}
                                  </span>
                                )}
                                {c.earnings_warning && (
                                  <span
                                    className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    title={`Quarterly earnings in ${c.days_until_earnings} days`}
                                  >
                                    Earnings in {c.days_until_earnings}d
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-400 truncate max-w-[220px]">
                                {c.company_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Sector & Gate */}
                        <td className="py-4 px-3 align-middle">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-950 border border-slate-800 text-slate-200 whitespace-nowrap">
                            {c.sector}
                          </span>
                          {isFin && (
                            <div className="text-xs font-mono text-cyan-400 mt-1 whitespace-nowrap">
                              Bank: ROA (Return on Assets) {c.roa_pct}%
                            </div>
                          )}
                        </td>

                        {/* Current Price */}
                        <td className="py-4 px-3 text-right font-mono align-middle whitespace-nowrap">
                          <div className="text-base font-bold text-white">
                            {currency}
                            {c.current_price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              c.day_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {c.day_change_pct >= 0 ? '+' : ''}
                            {c.day_change_pct}%
                          </div>
                        </td>

                        {/* 52W High Discount */}
                        <td className="py-4 px-3 text-right font-mono align-middle whitespace-nowrap">
                          <div className="text-cyan-400 font-bold">-{c.discount_52w_pct}% off</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            52W (52-Week) High: {currency}
                            {c.high_52w.toLocaleString()}
                          </div>
                        </td>

                        {/* Consensus Analyst Target */}
                        <td className="py-4 px-3 text-right font-mono align-middle whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                            <span>
                              {currency}
                              {c.consensus_target.toLocaleString()}
                            </span>
                            <span>(+{c.upside_pct}%)</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {c.analyst_count} Analysts • Forward P/E (Price-to-Earnings) {c.forward_pe}x
                          </div>
                        </td>

                        {/* Quality Shield */}
                        <td className="py-4 px-3 text-right font-mono align-middle whitespace-nowrap">
                          <div className="text-teal-300 font-bold">
                            ROE (Return on Equity) {c.roe_pct}%
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {isFin
                              ? `ROA (Return on Assets) ${c.roa_pct}%`
                              : `D/E (Debt-to-Equity) ${c.debt_to_equity}x`}
                          </div>
                        </td>

                        {/* Delivery & Volume */}
                        <td className="py-4 px-3 text-right font-mono align-middle whitespace-nowrap">
                          <div className="text-slate-200 font-semibold">{c.delivery_pct}% Delivery</div>
                          <div
                            className={`text-xs mt-0.5 ${
                              c.volume_surge_ratio >= 1.25 ? 'text-emerald-400 font-bold' : 'text-slate-400'
                            }`}
                          >
                            Volume Surge: {c.volume_surge_ratio}x
                          </div>
                        </td>

                        {/* RSI / EMA20 Trend */}
                        <td className="py-4 px-3 text-center font-mono align-middle whitespace-nowrap">
                          <div className="text-white font-semibold">
                            RSI (Relative Strength Index) {c.rsi_14}
                          </div>
                          <div className="text-xs text-emerald-400 mt-0.5">
                            {c.current_price >= c.ema_20 * 0.98
                              ? 'Above EMA20 (20-Day Avg)'
                              : 'Near EMA20 Support'}
                          </div>
                        </td>

                        {/* Bargain Score Ring */}
                        <td className="py-4 px-3 text-center align-middle">
                          <ScoreRing score={c.bargain_score} />
                        </td>

                        {/* Action Buttons */}
                        <td
                          className="py-4 px-4 text-right align-middle whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectStockForDeepDive(c.ticker)}
                              className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                            >
                              <BarChart3 className="w-4 h-4 shrink-0" />
                              <span>View Trade Plan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickAddPosition(c)}
                              title="Add this stock directly to your Family Portfolio"
                              className="h-9 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-emerald-400 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            >
                              <PlusCircle className="w-4 h-4 shrink-0" />
                              <span>Add</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {allCandidates.length > visibleLimit && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + 100)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-bold text-emerald-400 inline-flex items-center gap-2 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>
                    Show More Stocks ({allCandidates.length - visibleLimit} remaining)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
