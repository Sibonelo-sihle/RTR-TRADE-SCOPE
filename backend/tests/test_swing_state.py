from datetime import datetime
import unittest
import uuid
from pydantic import ValidationError

from app.main import close_swing, create_swing, invalidate_swing
from app.schemas import SwingStateIn


class FakeSession:
    def __init__(self, existing=None):
        self.existing = existing
        self.saved = None

    def scalar(self, _statement):
        return self.existing

    def add(self, item):
        self.saved = item
        if item.id is None: item.id = uuid.uuid4()

    def commit(self):
        return None

    def refresh(self, item):
        now = datetime.now().astimezone()
        item.created_at = getattr(item, "created_at", None) or now
        item.updated_at = now

    def get(self, _model, _item_id):
        return self.existing


def payload():
    return SwingStateIn(symbol="xauusd", direction="BUY", htf_zone_id="4H-Demand-1", htf_timeframe="4H", signal_timestamp=1700000000, entry_timeframe="15m", score=4, zone_type="Demand", zone_lower="2300", zone_upper="2310", four_h_bias="BULLISH", four_h_zone_id="4H-Demand-1", one_h_setup_id="1H-Demand-1", entry_price="2315", atr_buffer="2", stop="2298", tp1="2345", tp2="2360", tp1_structure_id="1H-Supply-1", tp2_structure_id="4H-Supply-1", rr_to_tp1="1.764706", rr_to_tp2="2.647059")


class SwingStateTests(unittest.TestCase):
    def test_setup_is_created_once_and_normalizes_symbol(self):
        db = FakeSession()
        created = create_swing(payload(), db)
        self.assertEqual(created.symbol, "XAUUSD")
        self.assertEqual(created.status, "ACTIVE")
        self.assertEqual(str(created.entry_price), "2315")
        existing_db = FakeSession(created)
        self.assertIs(create_swing(payload(), existing_db), created)
        self.assertIsNone(existing_db.saved)

    def test_close_and_invalidate_are_persisted_status_changes(self):
        item = create_swing(payload(), FakeSession())
        closed = close_swing(str(item.id), FakeSession(item))
        self.assertEqual(closed.status, "CLOSED")
        self.assertIsNotNone(closed.closed_at)
        active = create_swing(payload(), FakeSession())
        invalidated = invalidate_swing(str(active.id), FakeSession(active))
        self.assertEqual(invalidated.status, "INVALIDATED")

    def test_invalid_risk_and_sub_1_5r_targets_are_rejected(self):
        values = payload().model_dump()
        values["stop"] = values["entry_price"]
        with self.assertRaises(ValidationError): SwingStateIn(**values)
        values = payload().model_dump()
        values["rr_to_tp1"] = "1.49"
        with self.assertRaises(ValidationError): SwingStateIn(**values)

    def test_unavailable_target_requires_no_rr_value(self):
        values = payload().model_dump()
        values.update(tp2=None, tp2_structure_id=None, rr_to_tp2=None)
        plan = SwingStateIn(**values)
        self.assertIsNone(plan.tp2)
        self.assertIsNone(plan.rr_to_tp2)


if __name__ == "__main__":
    unittest.main()
