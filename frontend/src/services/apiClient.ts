import {
  MarketType,
  RegimeInfo,
  StrategyPreset,
  ScreenerFilterParams,
  ScreenerResponse,
  StockDeepDiveResponse,
  AIDebateReport,
  BacktestSummary,
  PortfolioResponse,
  PortfolioPosition,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_STORAGE_KEY = 'family_finance_session_token';
const PIN_STORAGE_KEY = 'family_finance_pin';

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setSessionToken(token: string, pin?: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (pin) {
    localStorage.setItem(PIN_STORAGE_KEY, pin);
  }
}

export function clearSessionAuth(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(PIN_STORAGE_KEY);
}

export function isSessionUnlocked(): boolean {
  return Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const savedPin = localStorage.getItem(PIN_STORAGE_KEY) || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(savedPin ? { 'X-Family-Pin': savedPin } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && path !== '/api/auth/verify-pin') {
    clearSessionAuth();
    window.dispatchEvent(new CustomEvent('familyfinance:unauthorized'));
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errBody.detail || `API Error (${response.status})`);
  }

  return response.json();
}

export const apiClient = {
  verifyPin: (pin: string) =>
    apiRequest<{ authenticated: boolean; token: string }>('/api/auth/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  getHealth: () => apiRequest<Record<string, unknown>>('/api/health'),

  getPresets: () => apiRequest<StrategyPreset[]>('/api/presets'),

  getRegime: (market: MarketType, forceRefresh = false) =>
    apiRequest<RegimeInfo>(`/api/regime?market=${market}&force_refresh=${forceRefresh}`),

  runScreener: (params: ScreenerFilterParams) =>
    apiRequest<ScreenerResponse>('/api/screener/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  triggerCacheRefresh: (market: string = 'ALL') =>
    apiRequest<{ message: string; state: Record<string, unknown> }>(`/api/cache/refresh?market=${market}`, {
      method: 'POST',
    }),

  getCacheStatus: () => apiRequest<Record<string, unknown>>('/api/cache/status'),

  getStockDeepDive: (
    ticker: string,
    market: MarketType,
    capital: number,
    riskPct: number,
    forceLiveAi = false
  ) =>
    apiRequest<StockDeepDiveResponse>(
      `/api/stock/${encodeURIComponent(ticker)}?market=${market}&capital=${capital}&risk_pct=${riskPct}&force_live_ai=${forceLiveAi}`
    ),

  runLiveAIDebate: (
    ticker: string,
    market: MarketType,
    capital: number,
    riskPct: number,
    geminiApiKey?: string
  ) =>
    apiRequest<AIDebateReport>(`/api/stock/${encodeURIComponent(ticker)}/ai-debate`, {
      method: 'POST',
      body: JSON.stringify({
        market,
        capital,
        risk_pct: riskPct,
        gemini_api_key: geminiApiKey || undefined,
      }),
    }),

  getBacktest: (ticker: string, market: MarketType) =>
    apiRequest<BacktestSummary>(`/api/backtest/${encodeURIComponent(ticker)}?market=${market}`),

  getPortfolio: (owner?: string, market?: string) => {
    const q = new URLSearchParams();
    if (owner && owner !== 'ALL') q.set('owner', owner);
    if (market && market !== 'ALL') q.set('market', market);
    return apiRequest<PortfolioResponse>(`/api/portfolio?${q.toString()}`);
  },

  createPortfolioPosition: (payload: Record<string, unknown>) =>
    apiRequest<PortfolioPosition>('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePortfolioPosition: (id: number, payload: Record<string, unknown>) =>
    apiRequest<PortfolioPosition>(`/api/portfolio/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deletePortfolioPosition: (id: number) =>
    apiRequest<{ deleted: boolean; id: number }>(`/api/portfolio/${id}`, {
      method: 'DELETE',
    }),

  exportBackup: () => apiRequest<Record<string, unknown>>('/api/backup/export'),

  importBackup: (payload: Record<string, unknown>) =>
    apiRequest<{ status: string; imported_positions: number; imported_presets: number }>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
