from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from time import sleep
import unittest

from app.services.market_data.base import Candle, MarketDataProvider, MarketDataUnavailable
from app.services.market_data.service import MarketDataService


class FakeProvider(MarketDataProvider):
    name = "fake"
    symbol_map = {"XAUUSD": "XAU/USD"}

    def __init__(self):
        self.calls = 0
        self.fail = False
        self.lock = Lock()

    def availability(self):
        return True, None

    def get_candles(self, symbol, timeframe, limit, start=None, end=None):
        with self.lock:
            self.calls += 1
        sleep(0.02)
        if self.fail:
            raise MarketDataUnavailable("temporary failure")
        return [Candle(time=1, open=1, high=2, low=0, close=1.5, volume=1)]


class MarketDataServiceTests(unittest.TestCase):
    def test_identical_requests_share_cache(self):
        provider = FakeProvider()
        service = MarketDataService(provider, cache_seconds=60)
        first = service.get_candles("XAUUSD", "5m", 500)
        second = service.get_candles("XAUUSD", "5m", 500)
        self.assertEqual(first, second)
        self.assertEqual(provider.calls, 1)

    def test_concurrent_identical_requests_are_coalesced(self):
        provider = FakeProvider()
        service = MarketDataService(provider, cache_seconds=60)
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: service.get_candles("XAUUSD", "15m", 500), range(8)))
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual(provider.calls, 1)

    def test_failed_request_is_not_cached(self):
        provider = FakeProvider()
        service = MarketDataService(provider, cache_seconds=60)
        provider.fail = True
        with self.assertRaises(MarketDataUnavailable):
            service.get_candles("XAUUSD", "5m", 500)
        provider.fail = False
        self.assertEqual(len(service.get_candles("XAUUSD", "5m", 500)), 1)
        self.assertEqual(provider.calls, 2)

    def test_larger_history_serves_latest_candle_without_another_request(self):
        provider = FakeProvider()
        service = MarketDataService(provider, cache_seconds=60)
        service.get_candles("XAUUSD", "5m", 500)
        latest = service.get_candles("XAUUSD", "5m", 1)
        self.assertEqual(len(latest), 1)
        self.assertEqual(provider.calls, 1)

    def test_timeframes_have_boundary_aware_refresh_cadence(self):
        self.assertEqual(MarketDataService.REFRESH_SECONDS, {
            "5m": 1800.0,
            "15m": 1800.0,
            "1H": 5400.0,
            "4H": 14400.0,
        })
        self.assertEqual(MarketDataService.seconds_until_next_refresh("5m", 1814), 1)
        self.assertEqual(MarketDataService.seconds_until_next_refresh("5m", 1815), 1800)


if __name__ == "__main__":
    unittest.main()
