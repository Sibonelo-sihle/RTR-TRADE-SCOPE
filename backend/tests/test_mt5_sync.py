from datetime import datetime, timezone
import unittest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from app.base import Base
from app.models import MT5Deal, MT5Position, MT5SyncRun, TradingAccount
from app.mt5_schemas import BridgeHeartbeatIn, BridgeSyncIn
from app.services.mt5_sync import ingest_mt5_sync, record_mt5_heartbeat
from app.config import settings
from app.main import bridge_auth
from fastapi import HTTPException
from app.services.mt5_sync import account_payload

def payload(*, connected=True, positions=True):
    return BridgeSyncIn(account={"account_key": "a" * 64, "label": "Personal Live", "broker": "JP Markets", "login_last4": "1234", "server": "JPMarkets-Live", "currency": "USD", "balance": "5240", "equity": "5310", "margin": "100", "free_margin": "5210", "leverage": 500}, terminal_connected=connected, account_connected=connected, terminal_version="5.0", positions=[{"position_ticket": 9001, "symbol": "XAUUSD", "direction": "BUY", "opened_at": "2026-08-14T10:00:00Z", "entry_price": "4340", "current_price": "4350", "volume": "0.5", "stop_loss": "4320", "take_profit": "4380", "floating_pnl": "50", "comment": "manual", "magic": 0}] if positions else [], deals=[{"deal_ticket": 7001, "order_ticket": 8001, "position_ticket": 9001, "executed_at": "2026-08-14T10:00:00Z", "symbol": "XAUUSD", "direction": "BUY", "entry_kind": "IN", "volume": "0.5", "price": "4340", "profit": "0", "commission": "-2", "swap": "0", "fee": "0", "comment": "manual", "magic": 0}], cursor_ticket=7001, synced_at=datetime.now(timezone.utc))

class MT5SyncTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine); self.db = Session(self.engine)
    def tearDown(self): self.db.close(); self.engine.dispose()
    def test_account_position_and_deal_are_normalized_and_idempotent(self):
        first = ingest_mt5_sync(self.db, payload()); second = ingest_mt5_sync(self.db, payload())
        self.assertEqual(first["new_deals"], 1); self.assertEqual(second["new_deals"], 0)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TradingAccount)), 1); self.assertEqual(self.db.scalar(select(func.count()).select_from(MT5Deal)), 1); self.assertEqual(self.db.scalar(select(func.count()).select_from(MT5Position)), 1)
        account = self.db.scalar(select(TradingAccount)); self.assertEqual(account.login_last4, "1234"); self.assertEqual(account.status, "CONNECTED")
        safe = account_payload(account); self.assertEqual(safe["login_masked"], "****1234"); self.assertNotIn("external_account_key", safe)
    def test_offline_snapshot_does_not_close_known_positions(self):
        ingest_mt5_sync(self.db, payload()); ingest_mt5_sync(self.db, payload(connected=False, positions=False))
        position = self.db.scalar(select(MT5Position)); self.assertTrue(position.is_open)
    def test_successful_empty_snapshot_marks_position_not_open(self):
        ingest_mt5_sync(self.db, payload()); ingest_mt5_sync(self.db, payload(positions=False))
        position = self.db.scalar(select(MT5Position)); self.assertFalse(position.is_open)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(MT5SyncRun)), 2)
    def test_offline_heartbeat_preserves_records_and_updates_status(self):
        ingest_mt5_sync(self.db, payload())
        account = self.db.scalar(select(TradingAccount)); record_mt5_heartbeat(self.db, BridgeHeartbeatIn(account_key=account.external_account_key, terminal_connected=False, account_connected=False, error="MT5 terminal unavailable", synced_at=datetime.now(timezone.utc)))
        self.assertEqual(account.status, "DISCONNECTED"); self.assertEqual(self.db.scalar(select(func.count()).select_from(MT5Deal)), 1); self.assertTrue(self.db.scalar(select(MT5Position)).is_open)
    def test_bridge_requires_strong_matching_token(self):
        original = settings.mt5_bridge_token
        try:
            settings.mt5_bridge_token = "x" * 40
            bridge_auth("x" * 40)
            with self.assertRaises(HTTPException): bridge_auth("wrong")
        finally: settings.mt5_bridge_token = original

if __name__ == "__main__": unittest.main()
