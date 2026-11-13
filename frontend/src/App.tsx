import React, { useState, useEffect, useCallback } from 'react';
import {
  MarketType,
  RegimeInfo,
  StrategyPreset,
  ScreenerFilterParams,
  ScreenerResponse,
  ScreenerCandidate,
  StockDeepDiveResponse,
  PortfolioResponse,
} from './types/api';
import { apiClient, isSessionUnlocked, clearSessionAuth } from './services/apiClient';
import { HeaderBar } from './components/HeaderBar';
import { RegimeBanner } from './components/RegimeBanner';
import { FunnelScreener } from './components/FunnelScreener';
import { StockDeepDive } from './components/StockDeepDive';
import { PortfolioTracker } from './components/PortfolioTracker';
import { PinLockscreen } from './components/PinLockscreen';
import { FinancialGuideModal } from './components/FinancialGuideModal';

const DEFAULT_INDIA_FILTERS: ScreenerFilterParams = {
  market: 'INDIA_NSE',
  cap_filter: 'ALL',
  min_upside_pct: 18.0,
  min_discount_52w_pct: 10.0,
  max_discount_52w_pct: 42.0,
  min_roe_pct: 13.0,
  max_debt_to_equity: 0.8,
  min_delivery_pct: 40.0,
  min_rsi: 40.0,
  max_rsi: 68.0,
  min_analyst_count: 3,
  sector_filter: 'ALL',
  capital: 500000,
  risk_pct: 1.0,
};

export const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isSessionUnlocked());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('family_finance_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  const [market, setMarket] = useState<MarketType>('INDIA_NSE');
  const [activeTab, setActiveTab] = useState<'screener' | 'deepdive' | 'portfolio'>('screener');
  const [plainEnglishMode, setPlainEnglishMode] = useState<boolean>(true);

  const [familyCapital, setFamilyCapital] = useState<number>(500000);
  const [filters, setFilters] = useState<ScreenerFilterParams>(DEFAULT_INDIA_FILTERS);
  const [presets, setPresets] = useState<StrategyPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [regime, setRegime] = useState<RegimeInfo | null>(null);
  const [showRegimeModal, setShowRegimeModal] = useState<boolean>(false);

  const [screenerData, setScreenerData] = useState<ScreenerResponse | null>(null);
  const [screenerLoading, setScreenerLoading] = useState<boolean>(false);

  const [selectedTicker, setSelectedTicker] = useState<string>('HDFCBANK.NS');
  const [deepDiveData, setDeepDiveData] = useState<StockDeepDiveResponse | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState<boolean>(false);
  const [runningAi, setRunningAi] = useState<boolean>(false);

  const [portfolioData, setPortfolioData] = useState<PortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState<boolean>(false);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync light/dark theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('family_finance_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Listen for 401 unauthorized events to re-lock the vault automatically
  useEffect(() => {
    const onUnauthorized = () => setIsUnlocked(false);
    window.addEventListener('familyfinance:unauthorized', onUnauthorized);
    return () => window.removeEventListener('familyfinance:unauthorized', onUnauthorized);
  }, []);

  // Load presets & portfolio when unlocked
  useEffect(() => {
    if (!isUnlocked) return;
    apiClient.getPresets().then(setPresets).catch(() => {});
    fetchPortfolio();
  }, [isUnlocked]);

  // Load Regime when market changes
  const fetchRegime = useCallback(async (mkt: MarketType, force = false) => {
    try {
      const r = await apiClient.getRegime(mkt, force);
      setRegime(r);
    } catch {
      // handled gracefully
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchRegime(market);
  }, [isUnlocked, market, fetchRegime]);

  // Run Funnel Screener whenever filters change
  useEffect(() => {
    if (!isUnlocked) return;
    let cancelled = false;
    setScreenerLoading(true);
    apiClient
      .runScreener({ ...filters, market, capital: familyCapital })
      .then((res) => {
        if (!cancelled) setScreenerData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setScreenerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isUnlocked,
    market,
    filters.cap_filter,
    filters.min_upside_pct,
    filters.min_discount_52w_pct,
    filters.max_discount_52w_pct,
    filters.min_roe_pct,
    filters.max_debt_to_equity,
    filters.min_delivery_pct,
    filters.min_rsi,
    filters.max_rsi,
    filters.min_analyst_count,
    filters.sector_filter,
    filters.risk_pct,
    familyCapital,
  ]);

  // Load Deep Dive when selectedTicker, market, familyCapital, or risk_pct changes
  const fetchDeepDive = useCallback(
    async (ticker: string, mkt: MarketType, cap: number, risk: number) => {
      setDeepDiveLoading(true);
      try {
        const d = await apiClient.getStockDeepDive(ticker, mkt, cap, risk);
        setDeepDiveData(d);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to load stock deep dive');
      } finally {
        setDeepDiveLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isUnlocked) return;
    fetchDeepDive(selectedTicker, market, familyCapital, filters.risk_pct);
  }, [isUnlocked, selectedTicker, market, familyCapital, filters.risk_pct, fetchDeepDive]);

  const fetchPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const p = await apiClient.getPortfolio();
      setPortfolioData(p);
    } catch {
      // handled gracefully
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Market Switcher Handler
  const handleMarketChange = (nextMarket: MarketType) => {
    if (nextMarket === market) return;
    setMarket(nextMarket);
    const defaultCap = nextMarket === 'INDIA_NSE' ? 500000 : 25000;
    const defaultSym = nextMarket === 'INDIA_NSE' ? 'HDFCBANK.NS' : 'NVDA';
    setFamilyCapital(defaultCap);
    setSelectedTicker(defaultSym);
    setFilters((prev) => ({
      ...prev,
      market: nextMarket,
      cap_filter: 'ALL',
      sector_filter: 'ALL',
      capital: defaultCap,
    }));
  };

  // Strategy Preset Handler
  const handleSelectPreset = (preset: StrategyPreset) => {
    setActivePresetId(preset.id);
    setFilters((prev) => ({
      ...prev,
      min_upside_pct: preset.min_upside_pct,
      min_discount_52w_pct: preset.min_discount_52w_pct,
      max_discount_52w_pct: preset.max_discount_52w_pct,
      min_roe_pct: preset.min_roe_pct,
      max_debt_to_equity: preset.max_debt_to_equity,
      min_delivery_pct: preset.min_delivery_pct,
      min_rsi: preset.min_rsi,
      max_rsi: preset.max_rsi,
      min_analyst_count: preset.min_analyst_count,
      risk_per_trade_pct: preset.risk_per_trade_pct,
      risk_pct: preset.risk_per_trade_pct,
    }));
    showToast(`Applied Strategy Preset: ${preset.name}`);
  };

  const handleResetFilters = () => {
    setActivePresetId(null);
    setFilters({
      ...DEFAULT_INDIA_FILTERS,
      market,
      cap_filter: 'ALL',
      capital: familyCapital,
    });
    showToast('Reset all filters to default settings');
  };

  const handleRefreshUniverse = async () => {
    setIsRefreshing(true);
    try {
      await apiClient.triggerCacheRefresh(market);
      await fetchRegime(market, true);
      const res = await apiClient.runScreener({ ...filters, market, capital: familyCapital });
      setScreenerData(res);
      showToast('Live NSE MCP & Yahoo Finance quotes synced!');
    } catch {
      showToast('Sync completed with cached fallback.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickAddCandidateToPortfolio = async (c: ScreenerCandidate) => {
    const t2 = c.consensus_target;
    const t1 = Number((c.current_price + 0.55 * (t2 - c.current_price)).toFixed(2));
    const stop = Number((c.current_price * 0.925).toFixed(2));
    const riskPerShare = Math.max(1, c.current_price - stop);
    const maxRiskAmt = familyCapital * (filters.risk_pct / 100);
    const maxCapShares = Math.floor((familyCapital * 0.18) / c.current_price);
    const shares = Math.max(1, Math.min(Math.floor(maxRiskAmt / riskPerShare), maxCapShares));

    await apiClient.createPortfolioPosition({
      ticker: c.ticker,
      company_name: c.company_name,
      market: c.market,
      sector: c.sector,
      owner: 'Joint',
      shares,
      entry_price: c.current_price,
      stop_loss_price: stop,
      target_1_price: t1,
      target_2_price: t2,
      notes: `Added from Smart Bargain Screener (Score: ${c.bargain_score}/100)`,
    });
    await fetchPortfolio();
    showToast(`Added ${shares} shares of ${c.ticker.replace('.NS', '')} to Shared Family Portfolio!`);
  };

  const handleAddDeepDiveTicketToPortfolio = async (owner: 'Saksham' | 'Family' | 'Joint') => {
    if (!deepDiveData) return;
    const tk = deepDiveData.trade_ticket;
    await apiClient.createPortfolioPosition({
      ticker: deepDiveData.ticker,
      company_name: deepDiveData.company_name,
      market: deepDiveData.market,
      sector: deepDiveData.sector,
      owner,
      shares: tk.position_sizing.recommended_shares,
      entry_price: deepDiveData.current_price,
      stop_loss_price: tk.stop_loss_price,
      target_1_price: tk.target_1_3m,
      target_2_price: tk.target_2_6m,
      notes: `Trade Plan (${deepDiveData.ai_debate.verdict}) — Score ${deepDiveData.score_breakdown.total_score}/100`,
    });
    await fetchPortfolio();
    showToast(
      `Added ${tk.position_sizing.recommended_shares} shares of ${deepDiveData.ticker.replace('.NS', '')} (${owner}) to Portfolio!`
    );
  };

  const handleRunLiveGemini = async (apiKey?: string) => {
    if (!deepDiveData) return;
    setRunningAi(true);
    try {
      const updatedReport = await apiClient.runLiveAIDebate(
        deepDiveData.ticker,
        market,
        familyCapital,
        filters.risk_pct,
        apiKey
      );
      setDeepDiveData({
        ...deepDiveData,
        ai_debate: updatedReport,
      });
      showToast(
        updatedReport.generation_mode === 'GEMINI_3_8_FLASH_PRIMARY'
          ? 'Generated live Gemini 3.8 Flash Multi-Agent Debate!'
          : updatedReport.generation_mode === 'GEMINI_3_5_FLASH_LITE_FALLBACK'
          ? 'Generated via Gemini 3.5 Flash-Lite Fallback!'
          : 'Refreshed Multi-Agent Institutional Synthesis!'
      );
    } catch {
      showToast('Could not run AI analysis.');
    } finally {
      setRunningAi(false);
    }
  };

  const handleExportBackup = async () => {
    const data = await apiClient.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `familyfinance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded FamilyFinance Portfolio & Presets backup!');
  };

  const handleImportBackup = async (payload: Record<string, unknown>) => {
    const res = await apiClient.importBackup(payload);
    await fetchPortfolio();
    showToast(`Restored ${res.imported_positions} family positions!`);
  };

  const handleLockApp = () => {
    clearSessionAuth();
    setIsUnlocked(false);
  };

  if (!isUnlocked) {
    return <PinLockscreen onAuthenticated={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Institutional Navigation & Control Bar */}
      <HeaderBar
        market={market}
        onMarketChange={handleMarketChange}
        regime={regime}
        onOpenRegimeModal={() => setShowRegimeModal(true)}
        familyCapital={familyCapital}
        onFamilyCapitalChange={setFamilyCapital}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        plainEnglishMode={plainEnglishMode}
        onTogglePlainEnglish={() => setPlainEnglishMode(!plainEnglishMode)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenGuideModal={() => setShowGuideModal(true)}
        onRefreshUniverse={handleRefreshUniverse}
        isRefreshing={isRefreshing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedTicker={selectedTicker}
        portfolioCount={portfolioData?.positions.length || 0}
        onLockApp={handleLockApp}
      />

      {/* Interactive Financial Terms & How It Works Guide Modal */}
      <FinancialGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm shadow-2xl border border-emerald-300">
          {toastMessage}
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5">
        {/* Market Regime Traffic Light Banner */}
        <RegimeBanner
          regime={regime}
          plainEnglishMode={plainEnglishMode}
          showModal={showRegimeModal}
          onCloseModal={() => setShowRegimeModal(false)}
          onOpenModal={() => setShowRegimeModal(true)}
        />

        {/* Tab 1: Smart Bargain Funnel Screener */}
        {activeTab === 'screener' && (
          <FunnelScreener
            filters={filters}
            onUpdateFilters={(next) => {
              setActivePresetId(null);
              setFilters((prev) => ({ ...prev, ...next }));
            }}
            onResetFilters={handleResetFilters}
            screenerData={screenerData}
            loading={screenerLoading}
            plainEnglishMode={plainEnglishMode}
            onSelectStockForDeepDive={(ticker) => {
              setSelectedTicker(ticker);
              setActiveTab('deepdive');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onQuickAddPosition={handleQuickAddCandidateToPortfolio}
            onOpenGuideModal={() => setShowGuideModal(true)}
          />
        )}

        {/* Tab 2: Stock Deep-Dive & Actionable Trade Ticket */}
        {activeTab === 'deepdive' && (
          <StockDeepDive
            data={deepDiveData}
            loading={deepDiveLoading}
            market={market}
            plainEnglishMode={plainEnglishMode}
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            onAddTicketToPortfolio={handleAddDeepDiveTicketToPortfolio}
            onRunLiveGemini={handleRunLiveGemini}
            runningAi={runningAi}
          />
        )}

        {/* Tab 3: Shared Family Portfolio & Capital Velocity Tracker */}
        {activeTab === 'portfolio' && (
          <PortfolioTracker
            portfolio={portfolioData}
            loading={portfolioLoading}
            plainEnglishMode={plainEnglishMode}
            onSelectStockForDeepDive={(ticker, posMarket) => {
              if (posMarket !== market) {
                setMarket(posMarket);
              }
              setSelectedTicker(ticker);
              setActiveTab('deepdive');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onCreatePosition={async (payload) => {
              await apiClient.createPortfolioPosition(payload);
              await fetchPortfolio();
              showToast('Saved new position to Shared Family Portfolio!');
            }}
            onUpdatePosition={async (id, payload) => {
              await apiClient.updatePortfolioPosition(id, payload);
              await fetchPortfolio();
              showToast('Updated family position & trailed Stop-Loss!');
            }}
            onDeletePosition={async (id) => {
              await apiClient.deletePortfolioPosition(id);
              await fetchPortfolio();
              showToast('Removed position from portfolio.');
            }}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 px-6 text-center text-sm text-slate-400">
        FamilyFinance — Stock Research, 3–6 Month Trade Planner &amp; Family Portfolio • Market data via NSE (National Stock Exchange) &amp; Yahoo Finance
      </footer>
    </div>
  );
};

export default App;
