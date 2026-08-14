from __future__ import annotations

from datetime import datetime, timezone
from importlib.util import find_spec
from typing import Any

from .base import Candle, MarketDataProvider, MarketDataUnavailable


class MT5MarketDataProvider(MarketDataProvider):
    name = "MT5"

    # Broker-specific aliases belong here, never in the frontend.
    symbol_map = {
        "XAUUSD": "XAUUSD",
        "EURUSD": "EURUSD",
        "GBPUSD": "GBPUSD",
        "USDJPY": "USDJPY",
    }
    timeframe_names = {"5m": "TIMEFRAME_M5", "15m": "TIMEFRAME_M15", "1H": "TIMEFRAME_H1", "4H": "TIMEFRAME_H4"}

    def availability(self) -> tuple[bool, str | None]:
        if find_spec("MetaTrader5") is None:
            return False, "The official MetaTrader5 Python module is not installed or supported in this runtime."
        return True, None

    @staticmethod
    def _module() -> Any:
        available, reason = MT5MarketDataProvider().availability()
        if not available:
            raise MarketDataUnavailable(reason or "MT5 is unavailable.")
        import MetaTrader5 as mt5  # type: ignore[import-not-found]

        return mt5

    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Candle]:
        mt5 = self._module()
        provider_symbol = self.symbol_map[symbol]
        provider_timeframe = getattr(mt5, self.timeframe_names[timeframe])
        if not mt5.initialize():
            raise MarketDataUnavailable(f"MT5 terminal initialization failed: {mt5.last_error()}")
        try:
            if not mt5.symbol_select(provider_symbol, True):
                raise MarketDataUnavailable(f"MT5 symbol is unavailable: {provider_symbol}")
            if start is not None:
                utc_start = start.astimezone(timezone.utc)
                utc_end = (end or datetime.now(timezone.utc)).astimezone(timezone.utc)
                rates = mt5.copy_rates_range(provider_symbol, provider_timeframe, utc_start, utc_end)
                if rates is not None and len(rates) > limit:
                    rates = rates[-limit:]
            else:
                rates = mt5.copy_rates_from_pos(provider_symbol, provider_timeframe, 0, limit)
            if rates is None:
                raise MarketDataUnavailable(f"MT5 candle request failed: {mt5.last_error()}")
            return [
                Candle(
                    time=int(rate["time"]),
                    open=float(rate["open"]),
                    high=float(rate["high"]),
                    low=float(rate["low"]),
                    close=float(rate["close"]),
                    volume=float(rate["real_volume"] or rate["tick_volume"]),
                )
                for rate in rates
            ]
        finally:
            mt5.shutdown()
