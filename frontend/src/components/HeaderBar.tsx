import React from 'react';
import {
  Shield,
  Gem,
  Rocket,
  RefreshCw,
  BookOpen,
  Wallet,
  Lock,
  TrendingUp,
  Layers,
  Briefcase,
  Sun,
  Moon,
  HelpCircle,
} from 'lucide-react';
import { MarketType, RegimeInfo, StrategyPreset } from '../types/api';

interface HeaderBarProps {
  market: MarketType;
  onMarketChange: (market: MarketType) => void;
  regime: RegimeInfo | null;
  onOpenRegimeModal: () => void;
  familyCapital: number;
  onFamilyCapitalChange: (val: number) => void;
  presets: StrategyPreset[];
  activePresetId: string | null;
  onSelectPreset: (preset: StrategyPreset) => void;
  plainEnglishMode: boolean;
  onTogglePlainEnglish: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenGuideModal: () => void;
  onRefreshUniverse: () => void;
  isRefreshing: boolean;
  activeTab: 'screener' | 'deepdive' | 'portfolio';
  onTabChange: (tab: 'screener' | 'deepdive' | 'portfolio') => void;
  selectedTicker: string;
  portfolioCount: number;
  onLockApp: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  market,
  onMarketChange,
  regime,
  onOpenRegimeModal,
  familyCapital,
  onFamilyCapitalChange,
  presets,
  activePresetId,
  onSelectPreset,
  plainEnglishMode,
  onTogglePlainEnglish,
  theme,
  onToggleTheme,
  onOpenGuideModal,
  onRefreshUniverse,
  isRefreshing,
  activeTab,
  onTabChange,
  selectedTicker,
  portfolioCount,
  onLockApp,
}) => {
  const currency = market === 'INDIA_NSE' ? '₹' : '$';

  const getRegimeBadgeStyle = () => {
    if (!regime) return 'bg-slate-900 text-slate-300 border-slate-700';
    if (regime.regime === 'GREEN_BULL') {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60';
    }
    if (regime.regime === 'AMBER_CAUTION') {
      return 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900/60';
    }
    return 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900/60';
  };

  const getPresetIcon = (id: string) => {
    if (id.includes('safe')) return <Shield className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (id.includes('bargain')) return <Gem className="w-4 h-4 text-cyan-400 shrink-0" />;
    return <Rocket className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5">
        {/* Top Row: Brand, Market Switcher, Market Health, Capital Input, Guide, Theme, Refresh & Lock */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <TrendingUp className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                Family<span className="text-emerald-400">Finance</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Stock Research, 3–6 Month Trade Planner &amp; Family Portfolio
              </p>
            </div>
          </div>

          {/* Controls — Uniform h-10 buttons & aligned flex items */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Market Toggle */}
            <div
              className="inline-flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800"
              role="group"
              aria-label="Market Selector"
            >
              <button
                type="button"
                onClick={() => onMarketChange('INDIA_NSE')}
                className={`h-8 px-3 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  market === 'INDIA_NSE'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                India — NSE (National Stock Exchange)
              </button>
              <button
                type="button"
                onClick={() => onMarketChange('US_NYSE')}
                className={`h-8 px-3 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  market === 'US_NYSE'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                US — NYSE / NASDAQ
              </button>
            </div>

            {/* 2. Market Health Button */}
            <button
              type="button"
              onClick={onOpenRegimeModal}
              className={`h-10 px-3.5 rounded-xl border text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap ${getRegimeBadgeStyle()}`}
              title="Click to view Market Health details"
            >
              <span>{regime ? regime.label : 'Loading Market...'}</span>
              {regime && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950/70 border border-slate-700/60">
                  {regime.benchmark_name}: {regime.index_level.toLocaleString()} (
                  {regime.day_change_pct >= 0 ? '+' : ''}
                  {regime.day_change_pct}%)
                </span>
              )}
            </button>

            {/* 3. Family Capital Input */}
            <div className="h-10 inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3.5 focus-within:border-emerald-500 transition-colors">
              <Wallet className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              <span className="text-sm text-slate-300 mr-1.5 whitespace-nowrap">
                Capital:
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400 mr-1">
                {currency}
              </span>
              <input
                type="number"
                value={familyCapital}
                min={1000}
                step={market === 'INDIA_NSE' ? 25000 : 1000}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) onFamilyCapitalChange(v);
                }}
                aria-label="Total Family Capital Input"
                className="w-24 bg-transparent text-sm font-mono font-bold text-white focus:outline-none"
              />
            </div>

            {/* 4. Key Terms & AI Guide Modal Button */}
            <button
              type="button"
              onClick={onOpenGuideModal}
              className="h-10 px-3.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              title="Learn what ROE, D/E, ROA, RSI, EMA20, Trade Plan, and AI Review mean"
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Key Terms &amp; AI Guide</span>
            </button>

            {/* 5. Simple Guide Inline Explanations Toggle */}
            <button
              type="button"
              onClick={onTogglePlainEnglish}
              className={`h-10 px-3 rounded-xl border text-sm font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
                plainEnglishMode
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Show or hide plain-English explanations on each section"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Hints: {plainEnglishMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* 6. Light / Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:border-emerald-500/50 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {/* 7. Refresh Live Prices Button */}
            <button
              type="button"
              onClick={onRefreshUniverse}
              disabled={isRefreshing}
              className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-emerald-400 hover:border-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-50"
              title="Refresh latest stock prices from NSE (National Stock Exchange) and Yahoo Finance"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
            </button>

            {/* 8. Lock App Button */}
            <button
              type="button"
              onClick={onLockApp}
              className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-rose-300 hover:border-rose-500/40 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              title="Lock FamilyFinance screen"
            >
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Lock App</span>
            </button>
          </div>
        </div>

        {/* Second Row: Main Navigation Tabs & Filter Presets */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Primary Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onTabChange('screener')}
              className={`h-10 px-4 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'screener'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>1. Stock Screener</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('deepdive')}
              className={`h-10 px-4 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'deepdive'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>2. Stock Analysis &amp; Trade Plan</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  activeTab === 'deepdive'
                    ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                    : 'bg-slate-800 text-emerald-400'
                }`}
              >
                {selectedTicker.replace('.NS', '')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('portfolio')}
              className={`h-10 px-4 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>3. Family Portfolio</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                  activeTab === 'portfolio'
                    ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {portfolioCount}
              </span>
            </button>
          </div>

          {/* Quick Filter Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-400 mr-1 whitespace-nowrap">
              Strategy Presets:
            </span>
            {presets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  title={preset.description}
                  className={`h-10 px-3.5 rounded-xl text-sm font-semibold border transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {getPresetIcon(preset.id)}
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
