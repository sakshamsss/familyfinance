from abc import ABC, abstractmethod
from typing import List, Dict, Any
import pandas as pd


class BaseMarketAdapter(ABC):
    """Abstract base interface for market data adapters (India NSE & US Equities)."""

    @abstractmethod
    async def fetch_batch_quotes(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetches batch quotes for a list of ticker symbols."""
        pass

    @abstractmethod
    async def fetch_stock_deep_dive(self, ticker: str, period: str = "3y") -> Dict[str, Any]:
        """Fetches full OHLCV history, fundamentals, and analyst target data for a single ticker."""
        pass

    @abstractmethod
    async def fetch_benchmark_regime_data(self) -> Dict[str, Any]:
        """Fetches benchmark index level, 50/200 EMA, Advance/Decline breadth, and VIX."""
        pass
