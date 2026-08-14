from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


SUPPORTED_TIMEFRAMES = ("5m", "15m", "1H", "4H")
SUPPORTED_SYMBOLS = ("XAUUSD", "EURUSD", "GBPUSD", "USDJPY")


@dataclass(frozen=True)
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketDataUnavailable(RuntimeError):
    """Raised when the configured provider cannot supply real market data."""


class MarketDataProvider(ABC):
    name: str
    symbol_map: dict[str, str]

    @property
    def supported_symbols(self) -> list[str]:
        return list(self.symbol_map)

    @abstractmethod
    def availability(self) -> tuple[bool, str | None]:
        """Return provider readiness without claiming a live connection."""

    @abstractmethod
    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Candle]:
        """Return normalized, oldest-first OHLC candles."""

    def get_latest_candle(self, symbol: str, timeframe: str) -> Candle:
        candles = self.get_candles(symbol=symbol, timeframe=timeframe, limit=1)
        if not candles:
            raise MarketDataUnavailable("The provider returned no candles.")
        return candles[-1]
