from __future__ import annotations

from datetime import datetime, timezone
from math import isfinite
from threading import Lock
from time import monotonic
from typing import Any

import httpx

from .base import Candle, MarketDataProvider, MarketDataUnavailable


class TwelveDataMarketDataProvider(MarketDataProvider):
    name = "Twelve Data"
    base_url = "https://api.twelvedata.com"
    symbol_map = {
        "XAUUSD": "XAU/USD",
        "EURUSD": "EUR/USD",
        "GBPUSD": "GBP/USD",
        "USDJPY": "USD/JPY",
    }
    timeframe_map = {"5m": "5min", "15m": "15min", "1H": "1h", "4H": "4h"}

    def __init__(self, api_key: str | None, timeout_seconds: float = 12.0):
        self.api_key = (api_key or "").strip()
        self.timeout_seconds = timeout_seconds
        self._availability_checked_at = 0.0
        self._availability_result: tuple[bool, str | None] | None = None
        self._availability_lock = Lock()

    def _request(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise MarketDataUnavailable("MARKET_DATA_API_KEY is not configured on the backend.")
        try:
            response = httpx.get(
                f"{self.base_url}/time_series",
                params=params,
                headers={"Authorization": f"apikey {self.api_key}"},
                timeout=self.timeout_seconds,
            )
        except httpx.RequestError as error:
            raise MarketDataUnavailable("Twelve Data could not be reached.") from error
        try:
            payload = response.json()
        except ValueError as error:
            raise MarketDataUnavailable("Twelve Data returned a malformed response.") from error
        if response.status_code == 429:
            raise MarketDataUnavailable("Twelve Data rate limit reached. Try again after the quota resets.")
        if response.status_code >= 400 or payload.get("status") == "error":
            message = str(payload.get("message") or f"HTTP {response.status_code}")
            raise MarketDataUnavailable(f"Twelve Data rejected the request: {message}")
        return payload

    def availability(self) -> tuple[bool, str | None]:
        now = monotonic()
        if self._availability_result is not None and now - self._availability_checked_at < 600:
            return self._availability_result
        with self._availability_lock:
            now = monotonic()
            if self._availability_result is not None and now - self._availability_checked_at < 600:
                return self._availability_result
            try:
                payload = self._request({"symbol": self.symbol_map["XAUUSD"], "interval": "15min", "outputsize": 1, "timezone": "UTC"})
                if not payload.get("values"):
                    result = (False, "Twelve Data returned no XAUUSD candles.")
                else:
                    result = (True, None)
            except MarketDataUnavailable as error:
                result = (False, str(error))
            self._availability_checked_at = now
            self._availability_result = result
            return result

    @staticmethod
    def _timestamp(value: object) -> int:
        if not isinstance(value, str):
            raise ValueError("missing datetime")
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp())

    @classmethod
    def _candle(cls, row: object) -> Candle:
        if not isinstance(row, dict):
            raise ValueError("candle is not an object")
        candle = Candle(
            time=cls._timestamp(row.get("datetime")),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row.get("volume") or 0),
        )
        values = (candle.open, candle.high, candle.low, candle.close, candle.volume)
        if not all(isfinite(value) for value in values) or candle.volume < 0:
            raise ValueError("candle contains invalid numeric data")
        if candle.high < max(candle.open, candle.close) or candle.low > min(candle.open, candle.close) or candle.low > candle.high:
            raise ValueError("candle OHLC range is inconsistent")
        return candle

    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Candle]:
        params: dict[str, Any] = {
            "symbol": self.symbol_map[symbol],
            "interval": self.timeframe_map[timeframe],
            "outputsize": limit,
            "timezone": "UTC",
            "order": "ASC",
        }
        if start is not None:
            params["start_date"] = start.astimezone(timezone.utc).isoformat()
        if end is not None:
            params["end_date"] = end.astimezone(timezone.utc).isoformat()
        payload = self._request(params)
        rows = payload.get("values")
        if not isinstance(rows, list) or not rows:
            raise MarketDataUnavailable("Twelve Data returned no candles for this request.")
        try:
            candles = [self._candle(row) for row in rows]
        except (KeyError, TypeError, ValueError) as error:
            raise MarketDataUnavailable(f"Twelve Data returned malformed candle data: {error}") from error
        candles.sort(key=lambda candle: candle.time)
        if len({candle.time for candle in candles}) != len(candles):
            raise MarketDataUnavailable("Twelve Data returned duplicate candle timestamps.")
        return candles
