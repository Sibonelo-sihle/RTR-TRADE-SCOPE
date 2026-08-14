from __future__ import annotations

from datetime import datetime
from threading import Lock
from time import monotonic, time

from .base import Candle, MarketDataProvider


class MarketDataService:
    """Provider-neutral candle access with timeframe-aware request coalescing."""

    REFRESH_SECONDS = {
        "5m": 600.0,
        "15m": 1800.0,
        "1H": 3600.0,
        "4H": 14400.0,
    }
    BOUNDARY_DELAY_SECONDS = 15.0

    @classmethod
    def seconds_until_next_refresh(cls, timeframe: str, wall_now: float) -> float:
        cadence = cls.REFRESH_SECONDS.get(timeframe, 15.0)
        next_boundary = ((wall_now - cls.BOUNDARY_DELAY_SECONDS) // cadence + 1) * cadence + cls.BOUNDARY_DELAY_SECONDS
        return max(1.0, next_boundary - wall_now)

    def __init__(
        self,
        provider: MarketDataProvider,
        cache_seconds: float | None = None,
        cache_seconds_by_timeframe: dict[str, float] | None = None,
    ):
        self.provider = provider
        self.cache_seconds = cache_seconds
        self.cache_seconds_by_timeframe = cache_seconds_by_timeframe or self.REFRESH_SECONDS
        self._cache: dict[tuple[object, ...], tuple[float, int, list[Candle]]] = {}
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
        key = (self.provider.name, symbol, timeframe, start, end)
        now = monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached and now < cached[0] and cached[1] >= limit:
                return cached[2][-limit:]
            key_lock = self._key_locks.setdefault(key, Lock())
        with key_lock:
            now = monotonic()
            with self._lock:
                cached = self._cache.get(key)
                if cached and now < cached[0] and cached[1] >= limit:
                    return cached[2][-limit:]
            candles = self.provider.get_candles(symbol, timeframe, limit, start, end)
            if self.cache_seconds is not None:
                expires_at = monotonic() + self.cache_seconds
            else:
                wall_now = time()
                if self.cache_seconds_by_timeframe is self.REFRESH_SECONDS:
                    lifetime = self.seconds_until_next_refresh(timeframe, wall_now)
                else:
                    cadence = self.cache_seconds_by_timeframe.get(timeframe, 15.0)
                    next_boundary = ((wall_now - self.BOUNDARY_DELAY_SECONDS) // cadence + 1) * cadence + self.BOUNDARY_DELAY_SECONDS
                    lifetime = max(1.0, next_boundary - wall_now)
                expires_at = monotonic() + lifetime
            with self._lock:
                self._cache[key] = (expires_at, limit, candles)
            return candles
