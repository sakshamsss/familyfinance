import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from db.models import CachedStockData, FamilyPosition, ScreenerPreset, AuditSignalLog
from config import INDIA_NSE_UNIVERSE, US_EQUITIES_UNIVERSE, DEFAULT_STRATEGY_PRESETS, ALL_CATALOG_META


# Curated institutional baseline metadata for top NSE & US stocks.
# Live prices, 52W highs/lows, technicals, and analyst targets are overlaid by NSE MCP & yfinance sync.
KNOWN_STOCK_PROFILES: Dict[str, Dict[str, Any]] = {
    # --- INDIA NSE CORE LEADERS ---
    "RELIANCE.NS": {"name": "Reliance Industries Ltd", "sector": "Energy", "industry": "Oil & Gas Refining & Marketing", "price": 1339.7, "high52": 1611.8, "low52": 1152.2, "target": 1645.0, "roe": 14.2, "roa": 5.4, "de": 0.44, "t_pe": 24.8, "f_pe": 20.5, "deliv": 58.4, "analysts": 36},
    "HDFCBANK.NS": {"name": "HDFC Bank Ltd", "sector": "Financial Services", "industry": "Private Sector Bank", "price": 804.0, "high52": 1017.5, "low52": 669.2, "target": 1025.0, "roe": 16.1, "roa": 1.82, "de": 0.0, "t_pe": 17.6, "f_pe": 13.8, "deliv": 64.2, "analysts": 42},
    "ICICIBANK.NS": {"name": "ICICI Bank Ltd", "sector": "Financial Services", "industry": "Private Sector Bank", "price": 1265.0, "high52": 1440.0, "low52": 1050.0, "target": 1560.0, "roe": 17.8, "roa": 2.15, "de": 0.0, "t_pe": 18.9, "f_pe": 15.8, "deliv": 61.5, "analysts": 40},
    "INFY.NS": {"name": "Infosys Ltd", "sector": "Information Technology", "industry": "IT Consulting & Software", "price": 1620.0, "high52": 1990.0, "low52": 1358.0, "target": 2010.0, "roe": 31.4, "roa": 19.2, "de": 0.08, "t_pe": 25.4, "f_pe": 21.8, "deliv": 59.0, "analysts": 41},
    "TCS.NS": {"name": "Tata Consultancy Services Ltd", "sector": "Information Technology", "industry": "IT Consulting & Software", "price": 2407.5, "high52": 3250.0, "low52": 2280.0, "target": 3050.0, "roe": 51.5, "roa": 30.4, "de": 0.07, "t_pe": 26.2, "f_pe": 22.4, "deliv": 62.1, "analysts": 43},
    "ITC.NS": {"name": "ITC Ltd", "sector": "Consumer Defensive", "industry": "FMCG & Diversified", "price": 445.0, "high52": 528.5, "low52": 399.0, "target": 540.0, "roe": 28.4, "roa": 22.1, "de": 0.01, "t_pe": 26.1, "f_pe": 23.0, "deliv": 65.8, "analysts": 35},
    "LT.NS": {"name": "Larsen & Toubro Ltd", "sector": "Industrials", "industry": "Engineering & Construction", "price": 3480.0, "high52": 4120.0, "low52": 3180.0, "target": 4280.0, "roe": 16.5, "roa": 5.2, "de": 0.48, "t_pe": 31.5, "f_pe": 25.2, "deliv": 55.3, "analysts": 34},
    "SUNPHARMA.NS": {"name": "Sun Pharmaceutical Industries", "sector": "Healthcare", "industry": "Specialty Pharmaceuticals", "price": 1745.0, "high52": 2080.0, "low52": 1480.0, "target": 2160.0, "roe": 16.8, "roa": 12.4, "de": 0.04, "t_pe": 35.2, "f_pe": 28.6, "deliv": 57.1, "analysts": 36},
    "TATAMOTORS.NS": {"name": "Tata Motors Ltd", "sector": "Consumer Cyclical", "industry": "Automobiles & Commercial Vehicles", "price": 785.0, "high52": 1142.0, "low52": 680.0, "target": 1030.0, "roe": 24.6, "roa": 7.8, "de": 0.62, "t_pe": 10.4, "f_pe": 8.9, "deliv": 46.5, "analysts": 31},
    "AXISBANK.NS": {"name": "Axis Bank Ltd", "sector": "Financial Services", "industry": "Private Sector Bank", "price": 1140.0, "high52": 1340.0, "low52": 995.0, "target": 1420.0, "roe": 16.4, "roa": 1.72, "de": 0.0, "t_pe": 13.5, "f_pe": 11.4, "deliv": 54.8, "analysts": 39},
    "NTPC.NS": {"name": "NTPC Ltd", "sector": "Utilities", "industry": "Power Generation", "price": 368.0, "high52": 448.0, "low52": 318.0, "target": 462.0, "roe": 13.8, "roa": 4.9, "de": 0.78, "t_pe": 17.2, "f_pe": 14.5, "deliv": 58.9, "analysts": 24},
    "POWERGRID.NS": {"name": "Power Grid Corp of India", "sector": "Utilities", "industry": "Power Transmission", "price": 308.0, "high52": 366.0, "low52": 268.0, "target": 378.0, "roe": 18.6, "roa": 6.4, "de": 0.82, "t_pe": 18.1, "f_pe": 15.9, "deliv": 63.0, "analysts": 22},
    "BAJFINANCE.NS": {"name": "Bajaj Finance Ltd", "sector": "Financial Services", "industry": "Consumer NBFC", "price": 6980.0, "high52": 8190.0, "low52": 6380.0, "target": 8650.0, "roe": 19.8, "roa": 4.45, "de": 0.0, "t_pe": 27.5, "f_pe": 21.8, "deliv": 51.2, "analysts": 34},
    "MARUTI.NS": {"name": "Maruti Suzuki India Ltd", "sector": "Consumer Cyclical", "industry": "Passenger Vehicles", "price": 11650.0, "high52": 13680.0, "low52": 10720.0, "target": 14400.0, "roe": 16.9, "roa": 12.1, "de": 0.01, "t_pe": 25.8, "f_pe": 21.9, "deliv": 56.4, "analysts": 38},
    "HCLTECH.NS": {"name": "HCL Technologies Ltd", "sector": "Information Technology", "industry": "IT Services & ER&D", "price": 1585.0, "high52": 1940.0, "low52": 1310.0, "target": 1980.0, "roe": 24.8, "roa": 16.5, "de": 0.08, "t_pe": 25.1, "f_pe": 21.6, "deliv": 58.2, "analysts": 39},
    "HAL.NS": {"name": "Hindustan Aeronautics Ltd", "sector": "Industrials", "industry": "Aerospace & Defence", "price": 4180.0, "high52": 5674.0, "low52": 3620.0, "target": 5450.0, "roe": 26.8, "roa": 11.4, "de": 0.01, "t_pe": 34.0, "f_pe": 28.2, "deliv": 49.5, "analysts": 16},
    "BEL.NS": {"name": "Bharat Electronics Ltd", "sector": "Industrials", "industry": "Defence Electronics", "price": 284.0, "high52": 340.5, "low52": 230.0, "target": 362.0, "roe": 26.2, "roa": 12.8, "de": 0.01, "t_pe": 42.1, "f_pe": 34.5, "deliv": 52.8, "analysts": 26},
    "PERSISTENT.NS": {"name": "Persistent Systems Ltd", "sector": "Information Technology", "industry": "Digital Engineering", "price": 5120.0, "high52": 6350.0, "low52": 4180.0, "target": 6420.0, "roe": 24.5, "roa": 16.2, "de": 0.05, "t_pe": 54.0, "f_pe": 41.5, "deliv": 48.9, "analysts": 32},
    "COFORGE.NS": {"name": "Coforge Ltd", "sector": "Information Technology", "industry": "IT Consulting & Solutions", "price": 7450.0, "high52": 9280.0, "low52": 5840.0, "target": 9480.0, "roe": 22.4, "roa": 13.8, "de": 0.14, "t_pe": 48.2, "f_pe": 36.8, "deliv": 50.4, "analysts": 29},
    "FEDERALBNK.NS": {"name": "The Federal Bank Ltd", "sector": "Financial Services", "industry": "Private Sector Bank", "price": 184.0, "high52": 217.0, "low52": 148.0, "target": 238.0, "roe": 14.8, "roa": 1.32, "de": 0.0, "t_pe": 11.2, "f_pe": 9.4, "deliv": 49.2, "analysts": 31},
    "NATCOPHARM.NS": {"name": "Natco Pharma Ltd", "sector": "Healthcare", "industry": "Complex Generics & Oncology", "price": 1280.0, "high52": 1638.0, "low52": 980.0, "target": 1690.0, "roe": 24.9, "roa": 20.1, "de": 0.03, "t_pe": 14.2, "f_pe": 11.8, "deliv": 53.6, "analysts": 11},
    "CHAMBLFERT.NS": {"name": "Chambal Fertilisers & Chemicals", "sector": "Basic Materials", "industry": "Agri Inputs & Specialty Chemicals", "price": 472.0, "high52": 578.0, "low52": 365.0, "target": 610.0, "roe": 18.4, "roa": 11.2, "de": 0.24, "t_pe": 13.8, "f_pe": 11.2, "deliv": 47.8, "analysts": 8},
    "KPITTECH.NS": {"name": "KPIT Technologies Ltd", "sector": "Information Technology", "industry": "Automotive Embedded Software", "price": 1390.0, "high52": 1928.0, "low52": 1240.0, "target": 1840.0, "roe": 29.8, "roa": 17.4, "de": 0.12, "t_pe": 52.0, "f_pe": 39.4, "deliv": 51.0, "analysts": 18},
    "POLYCAB.NS": {"name": "Polycab India Ltd", "sector": "Industrials", "industry": "Cables, Wires & FMEG", "price": 6280.0, "high52": 7605.0, "low52": 5240.0, "target": 7850.0, "roe": 23.4, "roa": 16.9, "de": 0.02, "t_pe": 46.5, "f_pe": 37.2, "deliv": 52.4, "analysts": 28},
    "CUMMINSIND.NS": {"name": "Cummins India Ltd", "sector": "Industrials", "industry": "Industrial Engines & Powergen", "price": 3390.0, "high52": 4170.0, "low52": 2980.0, "target": 4240.0, "roe": 27.6, "roa": 19.4, "de": 0.01, "t_pe": 44.8, "f_pe": 36.5, "deliv": 55.1, "analysts": 25},
    "SBIN.NS": {"name": "State Bank of India", "sector": "Financial Services", "industry": "Public Sector Bank", "price": 798.0, "high52": 912.0, "low52": 680.0, "target": 1015.0, "roe": 18.4, "roa": 1.18, "de": 0.0, "t_pe": 10.2, "f_pe": 8.8, "deliv": 52.3, "analysts": 38},
    "KOTAKBANK.NS": {"name": "Kotak Mahindra Bank Ltd", "sector": "Financial Services", "industry": "Private Sector Bank", "price": 1790.0, "high52": 2065.0, "low52": 1620.0, "target": 2180.0, "roe": 14.9, "roa": 2.35, "de": 0.0, "t_pe": 18.4, "f_pe": 15.6, "deliv": 60.4, "analysts": 37},
    "KARURVYSYA.NS": {"name": "Karur Vysya Bank Ltd", "sector": "Financial Services", "industry": "Regional Bank", "price": 218.0, "high52": 262.0, "low52": 172.0, "target": 282.0, "roe": 16.8, "roa": 1.68, "de": 0.0, "t_pe": 9.8, "f_pe": 8.2, "deliv": 53.4, "analysts": 14},
    "SHRIRAMFIN.NS": {"name": "Shriram Finance Ltd", "sector": "Financial Services", "industry": "Commercial Vehicle NBFC", "price": 2920.0, "high52": 3652.0, "low52": 2380.0, "target": 3720.0, "roe": 16.2, "roa": 3.25, "de": 0.0, "t_pe": 14.1, "f_pe": 11.6, "deliv": 56.8, "analysts": 32},
    "CHOLAFIN.NS": {"name": "Cholamandalam Investment & Finance", "sector": "Financial Services", "industry": "Diversified NBFC", "price": 1340.0, "high52": 1680.0, "low52": 1140.0, "target": 1720.0, "roe": 19.4, "roa": 2.55, "de": 0.0, "t_pe": 26.4, "f_pe": 20.8, "deliv": 52.0, "analysts": 28},
    "PFC.NS": {"name": "Power Finance Corporation Ltd", "sector": "Financial Services", "industry": "Power Infrastructure NBFC", "price": 448.0, "high52": 580.0, "low52": 382.0, "target": 590.0, "roe": 21.8, "roa": 2.65, "de": 0.0, "t_pe": 7.8, "f_pe": 6.6, "deliv": 48.4, "analysts": 12},
    "RECLTD.NS": {"name": "REC Ltd", "sector": "Financial Services", "industry": "Power Infrastructure NBFC", "price": 495.0, "high52": 654.0, "low52": 425.0, "target": 645.0, "roe": 22.1, "roa": 2.75, "de": 0.0, "t_pe": 8.4, "f_pe": 7.1, "deliv": 47.9, "analysts": 11},
    "CIPLA.NS": {"name": "Cipla Ltd", "sector": "Healthcare", "industry": "Respiratory & Generics Pharma", "price": 1465.0, "high52": 1702.0, "low52": 1310.0, "target": 1790.0, "roe": 16.4, "roa": 12.8, "de": 0.02, "t_pe": 27.4, "f_pe": 23.5, "deliv": 56.2, "analysts": 35},
    "DRREDDY.NS": {"name": "Dr. Reddy's Laboratories Ltd", "sector": "Healthcare", "industry": "Global Generics Pharma", "price": 1245.0, "high52": 1421.0, "low52": 1120.0, "target": 1520.0, "roe": 19.6, "roa": 14.8, "de": 0.07, "t_pe": 18.6, "f_pe": 16.2, "deliv": 54.0, "analysts": 34},
    "ZYDUSLIFE.NS": {"name": "Zydus Lifesciences Ltd", "sector": "Healthcare", "industry": "Pharmaceuticals", "price": 985.0, "high52": 1324.0, "low52": 885.0, "target": 1265.0, "roe": 20.4, "roa": 14.6, "de": 0.04, "t_pe": 22.8, "f_pe": 19.1, "deliv": 51.8, "analysts": 27},
    "M&M.NS": {"name": "Mahindra & Mahindra Ltd", "sector": "Consumer Cyclical", "industry": "SUVs & Farm Equipment", "price": 2890.0, "high52": 3290.0, "low52": 2410.0, "target": 3520.0, "roe": 18.9, "roa": 8.4, "de": 0.18, "t_pe": 28.4, "f_pe": 23.6, "deliv": 55.9, "analysts": 36},
    "BAJAJ-AUTO.NS": {"name": "Bajaj Auto Ltd", "sector": "Consumer Cyclical", "industry": "Two & Three Wheelers", "price": 9450.0, "high52": 12774.0, "low52": 8420.0, "target": 11850.0, "roe": 28.9, "roa": 21.4, "de": 0.02, "t_pe": 31.8, "f_pe": 26.4, "deliv": 52.1, "analysts": 37},
    "CGPOWER.NS": {"name": "CG Power and Industrial Solutions", "sector": "Industrials", "industry": "Power Systems & Industrial Motors", "price": 685.0, "high52": 875.0, "low52": 545.0, "target": 860.0, "roe": 27.4, "roa": 18.2, "de": 0.02, "t_pe": 64.0, "f_pe": 49.5, "deliv": 54.6, "analysts": 14},
    "KEI.NS": {"name": "KEI Industries Ltd", "sector": "Industrials", "industry": "EHV Cables & Wires", "price": 4120.0, "high52": 5040.0, "low52": 3480.0, "target": 5180.0, "roe": 20.4, "roa": 14.2, "de": 0.04, "t_pe": 51.2, "f_pe": 39.8, "deliv": 50.8, "analysts": 19},
    "BHARTIARTL.NS": {"name": "Bharti Airtel Ltd", "sector": "Communication Services", "industry": "Telecom Services", "price": 1595.0, "high52": 1779.0, "low52": 1260.0, "target": 1940.0, "roe": 18.2, "roa": 5.8, "de": 0.88, "t_pe": 48.0, "f_pe": 31.5, "deliv": 63.4, "analysts": 33},

    # --- US EQUITIES CORE LEADERS ---
    "NVDA": {"name": "NVIDIA Corporation", "sector": "Information Technology", "industry": "Semiconductors & AI Compute", "price": 136.5, "high52": 162.0, "low52": 98.0, "target": 178.0, "roe": 68.5, "roa": 42.1, "de": 0.19, "t_pe": 42.5, "f_pe": 29.8, "deliv": 58.0, "analysts": 54},
    "MSFT": {"name": "Microsoft Corporation", "sector": "Information Technology", "industry": "Cloud & Enterprise Software", "price": 422.0, "high52": 484.0, "low52": 388.0, "target": 515.0, "roe": 34.2, "roa": 18.5, "de": 0.24, "t_pe": 33.4, "f_pe": 27.9, "deliv": 61.0, "analysts": 52},
    "AAPL": {"name": "Apple Inc.", "sector": "Information Technology", "industry": "Consumer Ecosystem & Devices", "price": 226.0, "high52": 260.0, "low52": 186.0, "target": 265.0, "roe": 48.0, "roa": 24.2, "de": 0.45, "t_pe": 31.2, "f_pe": 27.4, "deliv": 56.0, "analysts": 44},
    "GOOGL": {"name": "Alphabet Inc.", "sector": "Communication Services", "industry": "Search, Cloud & AI", "price": 176.0, "high52": 212.0, "low52": 148.0, "target": 225.0, "roe": 30.8, "roa": 19.8, "de": 0.09, "t_pe": 22.8, "f_pe": 18.9, "deliv": 59.5, "analysts": 51},
    "AMZN": {"name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "industry": "Cloud AWS & E-Commerce", "price": 204.0, "high52": 242.0, "low52": 166.0, "target": 258.0, "roe": 23.4, "roa": 10.6, "de": 0.34, "t_pe": 36.5, "f_pe": 28.4, "deliv": 57.2, "analysts": 56},
    "META": {"name": "Meta Platforms Inc.", "sector": "Communication Services", "industry": "Digital Advertising & AI", "price": 578.0, "high52": 695.0, "low52": 460.0, "target": 715.0, "roe": 35.6, "roa": 22.4, "de": 0.18, "t_pe": 25.4, "f_pe": 21.2, "deliv": 58.8, "analysts": 50},
    "AMD": {"name": "Advanced Micro Devices Inc.", "sector": "Information Technology", "industry": "Data Center & Client CPUs/GPUs", "price": 142.0, "high52": 198.0, "low52": 122.0, "target": 188.0, "roe": 16.2, "roa": 9.4, "de": 0.05, "t_pe": 38.0, "f_pe": 24.5, "deliv": 52.4, "analysts": 45},
    "AVGO": {"name": "Broadcom Inc.", "sector": "Information Technology", "industry": "Custom AI Silicon & Networking", "price": 172.0, "high52": 214.0, "low52": 135.0, "target": 220.0, "roe": 38.4, "roa": 15.8, "de": 0.58, "t_pe": 34.8, "f_pe": 26.2, "deliv": 57.0, "analysts": 40},
    "CRM": {"name": "Salesforce Inc.", "sector": "Information Technology", "industry": "Enterprise CRM & Agentforce", "price": 292.0, "high52": 355.0, "low52": 235.0, "target": 368.0, "roe": 16.8, "roa": 9.6, "de": 0.16, "t_pe": 29.4, "f_pe": 24.1, "deliv": 55.6, "analysts": 43},
    "NFLX": {"name": "Netflix Inc.", "sector": "Communication Services", "industry": "Global Streaming Entertainment", "price": 795.0, "high52": 940.0, "low52": 620.0, "target": 965.0, "roe": 32.5, "roa": 16.4, "de": 0.42, "t_pe": 36.2, "f_pe": 28.9, "deliv": 54.8, "analysts": 41},
}

SECTOR_MAP_GUESS: List[tuple] = [
    (["BANK", "FIN", "PFC", "REC", "IRFC", "LIFE", "ICICIGI", "MCX", "JPM", "V", "MA"], "Financial Services", "Banking & Financial Services"),
    (["INFY", "TCS", "WIPRO", "TECH", "LTIM", "MPHASIS", "OFSS", "ELXSI", "LTTS", "CYIENT", "ZENSAR", "BSOFT", "SONAT", "INTELLECT", "NAUKRI", "AFFLE", "KPIT", "PERSISTENT", "COFORGE", "NVDA", "MSFT", "AAPL", "AMD", "AVGO", "CRM", "TSM", "ASML", "ORCL", "ADBE", "PANW", "NOW", "ANET", "KLAC", "SNPS", "CDNS"], "Information Technology", "Software & Semiconductors"),
    (["PHARM", "CIPLA", "REDDY", "DIVIS", "LUPIN", "ALKEM", "GLENMARK", "BIOCON", "IPCA", "LAURUS", "GRANULES", "ZYDUS", "APOLLO", "MAXHEALTH", "FORTIS", "LLY", "UNH", "ISRG", "TMO", "ABT", "REGN", "VRTX"], "Healthcare", "Pharmaceuticals & Healthcare"),
    (["MOTOR", "AUTO", "MARUTI", "M&M", "HEROMOTO", "ASHOK", "BHARATFORG", "MOTHERSON", "SONACOMS", "BALKRIS", "MRF", "TYRE", "EXIDE", "AMARA", "MINDA", "UBER", "BKNG"], "Consumer Cyclical", "Automobiles & Mobility"),
    (["POWER", "NTPC", "ONGC", "COAL", "GAIL", "IOC", "BPCL", "HPCL", "PETRONET", "IGL", "MGL", "NHPC", "SJVN", "CESC"], "Utilities", "Power & Energy Utilities"),
    (["STEEL", "HINDALCO", "VEDL", "NMDC", "CEM", "PIDILIT", "SRF", "DEEPAK", "CHAMBL"], "Basic Materials", "Specialty Chemicals & Materials"),
    (["HUL", "HINDUNILVR", "NESTLE", "BRITANNIA", "TATACONSUM", "ITC", "VARUN", "COST", "WMT", "HD"], "Consumer Defensive", "Consumer Staples & Retail"),
]


def _infer_sector_and_industry(ticker: str) -> tuple[str, str]:
    cat = ALL_CATALOG_META.get(ticker)
    if cat and cat.get("sector"):
        sec = cat["sector"]
        return sec, sec
    upper = ticker.upper()
    for keywords, sec, ind in SECTOR_MAP_GUESS:
        if any(k in upper for k in keywords):
            return sec, ind
    return "Industrials", "Capital Goods & Engineering"


def get_stock_cap_category(ticker: str, market_cap_cr: float = 0.0) -> str:
    """Returns 'LARGE_CAP', 'MID_CAP', or 'SMALL_CAP' for any stock."""
    cat = ALL_CATALOG_META.get(ticker)
    if cat and cat.get("cap_category"):
        return cat["cap_category"]
    if market_cap_cr >= 80000.0:
        return "LARGE_CAP"
    if market_cap_cr >= 20000.0:
        return "MID_CAP"
    return "SMALL_CAP"


def _compute_market_cap_for_tier(ticker: str, h: int) -> float:
    cap_tier = get_stock_cap_category(ticker, 50000.0)
    if cap_tier == "LARGE_CAP":
        return round(85000.0 + (h % 520000), 0)
    if cap_tier == "MID_CAP":
        return round(22000.0 + (h % 52000), 0)
    return round(4200.0 + (h % 14500), 0)


def _deterministic_profile_for_ticker(ticker: str, market: str) -> Dict[str, Any]:
    """Generates a deterministic, realistic institutional baseline for any ticker not in KNOWN_STOCK_PROFILES."""
    cat = ALL_CATALOG_META.get(ticker, {})
    if ticker in KNOWN_STOCK_PROFILES:
        p = dict(KNOWN_STOCK_PROFILES[ticker])
        p["market"] = market
        if cat.get("company_name"):
            p["name"] = cat["company_name"]
        if cat.get("sector"):
            p["sector"] = cat["sector"]
        return p

    h = int(hashlib.md5(ticker.encode("utf-8")).hexdigest()[:8], 16)
    sector, industry = _infer_sector_and_industry(ticker)
    is_fin = "Financial" in sector

    base_price = round(250.0 + (h % 2800), 2) if market == "INDIA_NSE" else round(65.0 + (h % 350), 2)
    # Realistic cross-sectional distribution across all Large, Mid & Small-Cap stocks:
    # Discounts range from 3% (near 52W high) to 46% (deep correction)
    discount_pct = 3.0 + (h % 42)
    high52 = round(base_price / (1.0 - discount_pct / 100.0), 2)
    low52 = round(base_price * (0.72 + (h % 18) / 100.0), 2)
    # Analyst upside ranges from 4% (fully valued) to 38% (high conviction bargain)
    upside_pct = 4.0 + ((h >> 3) % 35)
    target = round(base_price * (1.0 + upside_pct / 100.0), 2)

    # ROE ranges from 8.5% to 28.5%; D/E ranges from 0.05 to 1.45
    roe = round(8.5 + ((h >> 5) % 200) / 10.0, 1)
    roa = round(0.75 + ((h >> 7) % 160) / 100.0, 2) if is_fin else round(4.5 + ((h >> 7) % 160) / 10.0, 1)
    de = 0.0 if is_fin else round(0.05 + ((h >> 9) % 140) / 100.0, 2)
    t_pe = round(12.0 + (h % 36), 1)
    # ~68% of universe has forward PE < trailing PE
    f_pe = round(t_pe * (0.82 + ((h >> 4) % 26) / 100.0), 1)
    # Delivery % ranges from 28% to 66%
    deliv = round(28.0 + ((h >> 6) % 39), 1)
    analysts = 3 + (h % 28)

    clean_name = cat.get("company_name") or (
        ticker.replace(".NS", "").replace("-", " ").title() + (" Ltd" if market == "INDIA_NSE" else " Corp")
    )
    return {
        "name": clean_name,
        "sector": sector,
        "industry": industry,
        "market": market,
        "price": base_price,
        "high52": high52,
        "low52": low52,
        "target": target,
        "roe": roe,
        "roa": roa,
        "de": de,
        "t_pe": t_pe,
        "f_pe": f_pe,
        "deliv": deliv,
        "analysts": analysts,
    }


def build_cached_stock_model(ticker: str, market: str, profile: Optional[Dict[str, Any]] = None) -> CachedStockData:
    p = profile or _deterministic_profile_for_ticker(ticker, market)
    h = int(hashlib.md5(ticker.encode("utf-8")).hexdigest()[:8], 16)
    price = float(p["price"])
    prev_close = round(price / (1.0 + ((h % 35) - 12) / 1000.0), 2)
    day_change_pct = round(((price - prev_close) / prev_close) * 100.0, 2) if prev_close else 0.0

    target_median = float(p["target"])
    target_mean = round(target_median * 1.015, 2)
    target_high = round(target_median * 1.18, 2)
    target_low = round(max(price * 0.92, target_median * 0.84), 2)

    is_known = ticker in KNOWN_STOCK_PROFILES
    ema_20 = round(price * (0.988 + (h % 22) / 1000.0), 2) if is_known else round(price * (0.95 + (h % 90) / 1000.0), 2)
    ema_50 = round(price * (0.965 + (h % 30) / 1000.0), 2) if is_known else round(price * (0.93 + (h % 110) / 1000.0), 2)
    ema_200 = round(price * (0.925 + (h % 35) / 1000.0), 2)
    rsi_14 = round(46.0 + (h % 17), 1) if is_known else round(30.0 + (h % 46), 1)
    atr_14 = round(price * 0.022, 2)
    swing_low_20d = round(min(price * 0.955, ema_20 * 0.97), 2)
    vol_surge = round(1.22 + (h % 42) / 100.0, 2) if is_known else round(0.85 + (h % 75) / 100.0, 2)
    rs_20d = round(1.2 + (h % 65) / 10.0, 2) if is_known else round(-3.5 + (h % 110) / 10.0, 2)
    vcp_ratio = round(0.68 + (h % 26) / 100.0, 2) if is_known else round(0.65 + (h % 55) / 100.0, 2)
    days_earnings = 18 + (h % 55) if is_known else (4 + (h % 65))
    mcap_cr = _compute_market_cap_for_tier(ticker, h)

    return CachedStockData(
        ticker=ticker,
        market=market,
        company_name=p["name"],
        sector=p["sector"],
        industry=p["industry"],
        current_price=price,
        previous_close=prev_close,
        day_change_pct=day_change_pct,
        high_52w=float(p["high52"]),
        low_52w=float(p["low52"]),
        target_median_price=target_median,
        target_mean_price=target_mean,
        target_high_price=target_high,
        target_low_price=target_low,
        analyst_count=int(p["analysts"]),
        trailing_pe=float(p["t_pe"]),
        forward_pe=float(p["f_pe"]),
        roe_pct=float(p["roe"]),
        roa_pct=float(p["roa"]),
        debt_to_equity=float(p["de"]),
        market_cap_cr=mcap_cr,
        delivery_pct=float(p["deliv"]),
        volume_surge_ratio=vol_surge,
        last_volume=float(1250000 + (h % 8000000)),
        ema_20=ema_20,
        ema_50=ema_50,
        ema_200=ema_200,
        rsi_14=rsi_14,
        atr_14=atr_14,
        swing_low_20d=swing_low_20d,
        rs_20d=rs_20d,
        vcp_tightness_ratio=vcp_ratio,
        days_until_earnings=days_earnings,
        data_source="SEED+NSE_MCP",
        updated_at=datetime.now(timezone.utc),
    )


def seed_initial_database(db: Session) -> None:
    """Seeds all 650 Indian NSE stocks (500 Large/Mid + 150 Small-Cap), 250 US stocks, 3 Strategy Presets, and initial Family Portfolio."""
    valid_tickers = set(INDIA_NSE_UNIVERSE) | set(US_EQUITIES_UNIVERSE)
    db.query(CachedStockData).filter(~CachedStockData.ticker.in_(valid_tickers)).delete(synchronize_session=False)
    db.commit()

    existing_rows = db.query(CachedStockData).all()
    existing_map = {r.ticker: r for r in existing_rows}

    to_insert = []
    for sym in INDIA_NSE_UNIVERSE:
        if sym not in existing_map:
            to_insert.append(build_cached_stock_model(sym, "INDIA_NSE"))
        else:
            row = existing_map[sym]
            cat = ALL_CATALOG_META.get(sym, {})
            h = int(hashlib.md5(sym.encode("utf-8")).hexdigest()[:8], 16)
            if cat.get("company_name"):
                row.company_name = cat["company_name"]
            if cat.get("sector"):
                row.sector = cat["sector"]
            row.market_cap_cr = _compute_market_cap_for_tier(sym, h)

    for sym in US_EQUITIES_UNIVERSE:
        if sym not in existing_map:
            to_insert.append(build_cached_stock_model(sym, "US_NYSE"))
        else:
            row = existing_map[sym]
            cat = ALL_CATALOG_META.get(sym, {})
            h = int(hashlib.md5(sym.encode("utf-8")).hexdigest()[:8], 16)
            if cat.get("company_name"):
                row.company_name = cat["company_name"]
            if cat.get("sector"):
                row.sector = cat["sector"]
            row.market_cap_cr = _compute_market_cap_for_tier(sym, h)

    if to_insert:
        db.bulk_save_objects(to_insert)
    db.commit()

    # Seed or refresh Strategy Presets
    db.query(ScreenerPreset).delete()
    for preset in DEFAULT_STRATEGY_PRESETS:
        db.add(ScreenerPreset(**preset))
    db.commit()

    # Normalize any legacy owner labels to "Family"
    legacy_positions = db.query(FamilyPosition).filter(~FamilyPosition.owner.in_(["Saksham", "Family", "Joint"])).all()
    if legacy_positions:
        for lp in legacy_positions:
            lp.owner = "Family"
        db.commit()

    # Seed Initial Family Portfolio Positions if none exist
    if db.query(FamilyPosition).count() == 0:
        today = datetime.now(timezone.utc).date()
        d_recent = (today - timedelta(days=28)).isoformat()
        d_older = (today - timedelta(days=78)).isoformat()
        d_mid = (today - timedelta(days=42)).isoformat()

        initial_positions = [
            FamilyPosition(
                ticker="HDFCBANK.NS",
                company_name="HDFC Bank Ltd",
                market="INDIA_NSE",
                sector="Financial Services",
                owner="Family",
                status="ACTIVE",
                shares=110,
                entry_price=765.0,
                entry_date=d_mid,
                stop_loss_price=715.0,
                target_1_price=885.0,
                target_2_price=985.0,
                partial_booked=False,
                notes="Core banking compounder accumulated in support buy zone.",
            ),
            FamilyPosition(
                ticker="ICICIBANK.NS",
                company_name="ICICI Bank Ltd",
                market="INDIA_NSE",
                sector="Financial Services",
                owner="Joint",
                status="ACTIVE",
                shares=60,
                entry_price=1420.0,
                entry_date=d_recent,
                stop_loss_price=1320.0,
                target_1_price=1565.0,
                target_2_price=1820.0,
                partial_booked=False,
                notes="Hit 3-Month Target 1 — ready to book 50% (30 shares) and trail stop to cost.",
            ),
            FamilyPosition(
                ticker="RELIANCE.NS",
                company_name="Reliance Industries Ltd",
                market="INDIA_NSE",
                sector="Energy",
                owner="Saksham",
                status="ACTIVE",
                shares=45,
                entry_price=1325.0,
                entry_date=d_older,
                stop_loss_price=1230.0,
                target_1_price=1480.0,
                target_2_price=1610.0,
                partial_booked=False,
                notes="Monitor 75-day capital velocity rule for potential rotation.",
            ),
            FamilyPosition(
                ticker="NVDA",
                company_name="NVIDIA Corporation",
                market="US_NYSE",
                sector="Information Technology",
                owner="Saksham",
                status="ACTIVE",
                shares=30,
                entry_price=144.0,
                entry_date=d_recent,
                stop_loss_price=132.0,
                target_1_price=185.0,
                target_2_price=225.0,
                partial_booked=False,
                notes="US AI compute leader held for next-gen data center ramp.",
            ),
        ]
        db.add_all(initial_positions)
        db.commit()


def get_cached_universe(db: Session, market: str = "INDIA_NSE") -> List[CachedStockData]:
    return db.query(CachedStockData).filter(CachedStockData.market == market).all()


def get_cached_stock(db: Session, ticker: str, market: str = "INDIA_NSE") -> Optional[CachedStockData]:
    norm = ticker.upper().strip()
    if market == "INDIA_NSE" and not norm.endswith(".NS") and not norm.endswith(".BO"):
        norm = f"{norm}.NS"
    row = db.query(CachedStockData).filter(CachedStockData.ticker == norm).first()
    if not row:
        row = db.query(CachedStockData).filter(CachedStockData.ticker == ticker.upper().strip()).first()
    return row


def upsert_cached_stock(db: Session, data: Dict[str, Any]) -> CachedStockData:
    ticker = data["ticker"]
    existing = db.query(CachedStockData).filter(CachedStockData.ticker == ticker).first()
    if existing:
        for k, v in data.items():
            if hasattr(existing, k) and v is not None:
                setattr(existing, k, v)
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_row = CachedStockData(**data)
        db.add(new_row)
        db.commit()
        db.refresh(new_row)
        return new_row


def export_backup_json(db: Session) -> Dict[str, Any]:
    positions = db.query(FamilyPosition).all()
    presets = db.query(ScreenerPreset).all()
    logs = db.query(AuditSignalLog).order_by(AuditSignalLog.created_at.desc()).limit(100).all()

    return {
        "schema_version": "1.0.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "positions": [
            {
                "ticker": p.ticker,
                "company_name": p.company_name,
                "market": p.market,
                "sector": p.sector,
                "owner": p.owner,
                "status": p.status,
                "shares": p.shares,
                "entry_price": p.entry_price,
                "entry_date": p.entry_date,
                "stop_loss_price": p.stop_loss_price,
                "target_1_price": p.target_1_price,
                "target_2_price": p.target_2_price,
                "partial_booked": p.partial_booked,
                "notes": p.notes,
            }
            for p in positions
        ],
        "presets": [
            {
                "id": pr.id,
                "name": pr.name,
                "badge": pr.badge,
                "description": pr.description,
                "min_upside_pct": pr.min_upside_pct,
                "min_discount_52w_pct": pr.min_discount_52w_pct,
                "max_discount_52w_pct": pr.max_discount_52w_pct,
                "min_roe_pct": pr.min_roe_pct,
                "max_debt_to_equity": pr.max_debt_to_equity,
                "min_delivery_pct": pr.min_delivery_pct,
                "min_rsi": pr.min_rsi,
                "max_rsi": pr.max_rsi,
                "min_analyst_count": pr.min_analyst_count,
                "risk_per_trade_pct": pr.risk_per_trade_pct,
            }
            for pr in presets
        ],
        "audit_logs_count": len(logs),
    }


def import_backup_json(db: Session, payload: Dict[str, Any], replace_existing: bool = True) -> Dict[str, int]:
    positions_data = payload.get("positions", [])
    presets_data = payload.get("presets", [])

    if replace_existing and positions_data:
        db.query(FamilyPosition).delete()

    pos_count = 0
    for item in positions_data:
        pos = FamilyPosition(
            ticker=item["ticker"],
            company_name=item.get("company_name", item["ticker"]),
            market=item.get("market", "INDIA_NSE"),
            sector=item.get("sector", "Industrials"),
            owner=item.get("owner", "Joint"),
            status=item.get("status", "ACTIVE"),
            shares=int(item.get("shares", 1)),
            entry_price=float(item.get("entry_price", 100.0)),
            entry_date=item.get("entry_date", datetime.now(timezone.utc).date().isoformat()),
            stop_loss_price=float(item.get("stop_loss_price", 90.0)),
            target_1_price=float(item.get("target_1_price", 115.0)),
            target_2_price=float(item.get("target_2_price", 130.0)),
            partial_booked=bool(item.get("partial_booked", False)),
            notes=item.get("notes", ""),
        )
        db.add(pos)
        pos_count += 1

    preset_count = 0
    for pr in presets_data:
        existing = db.query(ScreenerPreset).filter(ScreenerPreset.id == pr["id"]).first()
        if existing:
            for k, v in pr.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            db.add(ScreenerPreset(**pr))
        preset_count += 1

    db.commit()
    return {"imported_positions": pos_count, "imported_presets": preset_count}
