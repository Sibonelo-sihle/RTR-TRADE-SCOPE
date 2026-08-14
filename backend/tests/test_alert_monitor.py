from decimal import Decimal
from types import SimpleNamespace
import unittest

from app.services.alert_monitor import AlertMonitor
from app.services.market_data.base import Candle, MarketDataProvider
from app.services.market_data.service import MarketDataService


class RecordingProvider(MarketDataProvider):
    name = "recording"
    symbol_map = {"XAUUSD": "XAU/USD"}

    def __init__(self):
        self.requests = []

    def availability(self):
        return True, None

    def get_candles(self, symbol, timeframe, limit, start=None, end=None):
        self.requests.append((symbol, timeframe, limit))
        return [Candle(time=1, open=1, high=2, low=0, close=1.5, volume=1)]


class FakeSession:
    def __init__(self, alerts):
        self.alerts = alerts
        self.commits = 0

    def scalars(self, _statement):
        return self.alerts

    def commit(self):
        self.commits += 1


class AlertMonitorTests(unittest.TestCase):
    def test_alerts_are_grouped_and_use_one_minimal_request_per_symbol(self):
        alerts = [
            SimpleNamespace(
                id=index,
                symbol="XAUUSD",
                target_price=Decimal("100"),
                condition="ABOVE",
                status="ACTIVE",
                triggered_at=None,
            )
            for index in range(10)
        ]
        provider = RecordingProvider()
        monitor = AlertMonitor(MarketDataService(provider, cache_seconds=60))

        result = monitor.check(FakeSession(alerts))

        self.assertEqual(result["alerts_checked"], 10)
        self.assertEqual(result["symbols_checked"], 1)
        self.assertEqual(provider.requests, [("XAUUSD", "5m", 1)])

    def test_no_active_alerts_make_no_market_data_requests(self):
        provider = RecordingProvider()
        monitor = AlertMonitor(MarketDataService(provider, cache_seconds=60))

        result = monitor.check(FakeSession([]))

        self.assertEqual(result["alerts_checked"], 0)
        self.assertEqual(provider.requests, [])


if __name__ == "__main__":
    unittest.main()
