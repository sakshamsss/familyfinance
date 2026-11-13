# FamilyFinance — Stock Research, Trade Planner & Family Portfolio

**Primary Users:** Private Family Investment Office  
**Target Markets:** Primary: India (`NSE (National Stock Exchange)` via Official NSE MCP + Yahoo Finance) | Secondary: US (`NYSE / NASDAQ (New York Stock Exchange / National Association of Securities Dealers Automated Quotations)` via Yahoo Finance / Finnhub)  
**Investment Horizon:** 3 to 6 Months Positional Compounding (High Capital Velocity, Low-to-Moderate Risk)

---

## Core Architectural Pillars

1. **Zero LLM Math Hallucinations:** Every financial ratio, technical indicator (`EMA (Exponential Moving Average) 20/50/200`, `RSI (Relative Strength Index) 14`, `ATR (Average True Range) 14`), support/resistance zone, buy zone, 3M/6M target price, stop-loss (`[-10%, -5.5%]` clamped), Indian delivery tax/brokerage deduction (`0.25%` `STT (Securities Transaction Tax)`/Stamp/Exchange friction + `12.5%` tax reserve), and share quantity (`18%` diversification cap) is computed deterministically in Python.
2. **Zero-Timeout Screener:** Combines SQLite/PostgreSQL cached fundamentals with Official NSE MCP batch tools (`nse-bhavcopy` `get_bulk_quote` & `cm-market` `cm_get_stock_quote`) + `yf.download(..., threads=True)` so the 150-stock India NSE and 40-stock US funnel executes in **under 50ms**.
3. **Sector-Aware Quantitative Gates:** Financial Services / Banking stocks are automatically exempted from `D/E (Debt-to-Equity) < 1.0` and evaluated on `ROA (Return on Assets) >= 1.1%` and `ROE (Return on Equity) >= 13%`.
4. **FamilyFinance PIN Gate (`0410`):** Full-screen lockscreen (`PinLockscreen.tsx`) with tactile keypad, keyboard digit support, auto-submit on the 4th digit, constant-time backend verification (`secrets.compare_digest` on `POST /api/auth/verify-pin`), signed session tokens, `localStorage` persistence, a manual `Lock App` button in the header, and strict `/api/*` middleware protection.
5. **Quota-Smart 2-Step AI Multi-Agent Engine (`gemini-3.8-flash`):** Orchestrates **Call 1: Adversarial Bull vs. Bear Analyst** (`ThinkingLevel.MEDIUM`) and **Call 2: The Family Investment Judge** (`ThinkingLevel.HIGH`) with a 2-second polite pause, exponential backoff on `429 RESOURCE_EXHAUSTED`, automatic fallback to `gemini-3.5-flash-lite`, and 24-hour SQLite/PostgreSQL report caching (`ai_reports_cache` keyed by `ticker + YYYY-MM-DD`).

---

## Quick Start (Local Development)

### 1. Start the FastAPI Backend (`http://localhost:8000`)
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the React + Vite Frontend (`http://localhost:5173`)
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables (`.env`)

No paid subscriptions are required to run FamilyFinance—NSE's Official MCP endpoints (`https://mcp.nseindia.in/bhavcopy/cm/mcp` and `https://mcp.nseindia.in/cmmkt/mcp`) and `yfinance` are keyless, and the AI engine runs on the unbilled Google AI Studio Free Tier:
- `FAMILY_ACCESS_PIN=0410`: Shared 4-digit PIN (Personal Identification Number) for unlocking the FamilyFinance Lockscreen and `/api/*` routes
- `GEMINI_API_KEY`: Free Google AI Studio API key (can also be entered directly in the UI via the API Key button on the Stock Analysis page)
- `PRIMARY_AI_MODEL=gemini-3.8-flash`: Primary model supporting `ThinkingLevel.MEDIUM` (Bull/Bear Debate) and `ThinkingLevel.HIGH` (Family Judge)
- `FALLBACK_AI_MODEL=gemini-3.5-flash-lite`: Automatic fallback model when `429 RESOURCE_EXHAUSTED` quota limits are reached
- `FINNHUB_API_KEY`: Optional Finnhub key for secondary US equities fallback
- `DATABASE_URL`: Defaults to `sqlite:///./family_alpha.db` (or set to a Supabase/Neon PostgreSQL connection string)
