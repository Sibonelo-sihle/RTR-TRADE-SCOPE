from __future__ import annotations

from datetime import datetime
from threading import Lock
from time import monotonic

from .base import Candle, MarketDataProvider


class MarketDataService:
    """Provider-neutral candle access with a brief in-process history cache."""

    def __init__(self, provider: MarketDataProvider, cache_seconds: float = 15.0):
        self.provider = provider
        self.cache_seconds = cache_seconds
        self._cache: dict[tuple[object, ...], tuple[float, list[Candle]]] = {}
        self._key_locks: dict[tuple[object, ...], Lock] = {}
        self._lock = Lock()

    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Candle]:
        key = (self.provider.name, symbol, timeframe, limit, start, end)
        now = monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] < self.cache_seconds:
                return cached[1]
            key_lock = self._key_locks.setdefault(key, Lock())
        with key_lock:
            now = monotonic()
            with self._lock:
                cached = self._cache.get(key)
                if cached and now - cached[0] < self.cache_seconds:
                    return cached[1]
            candles = self.provider.get_candles(symbol, timeframe, limit, start, end)
            with self._lock:
                self._cache[key] = (monotonic(), candles)
            return candles
