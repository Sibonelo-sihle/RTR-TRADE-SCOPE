from __future__ import annotations

from datetime import datetime
from threading import Lock
from time import monotonic

from .base import Candle, MarketDataProvider


class MarketDataService:
    """Provider-neutral candle access with timeframe-aware request coalescing."""

    DEFAULT_CACHE_SECONDS = {
        "5m": 285.0,
        "15m": 885.0,
        "1H": 3540.0,
        "4H": 14340.0,
    }

    def __init__(
        self,
        provider: MarketDataProvider,
        cache_seconds: float | None = None,
        cache_seconds_by_timeframe: dict[str, float] | None = None,
    ):
        self.provider = provider
        self.cache_seconds = cache_seconds
        self.cache_seconds_by_timeframe = cache_seconds_by_timeframe or self.DEFAULT_CACHE_SECONDS
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
        cache_seconds = self.cache_seconds if self.cache_seconds is not None else self.cache_seconds_by_timeframe.get(timeframe, 15.0)
        now = monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] < cache_seconds:
                return cached[1]
            key_lock = self._key_locks.setdefault(key, Lock())
        with key_lock:
            now = monotonic()
            with self._lock:
                cached = self._cache.get(key)
                if cached and now - cached[0] < cache_seconds:
                    return cached[1]
            candles = self.provider.get_candles(symbol, timeframe, limit, start, end)
            with self._lock:
                self._cache[key] = (monotonic(), candles)
            return candles
