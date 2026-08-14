from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Alert
from .market_data import MarketDataService, MarketDataUnavailable


class AlertMonitor:
    """Evaluate stored alert definitions without executing trades."""

    def __init__(self, market_data: MarketDataService):
        self.market_data = market_data

    def check(self, db: Session) -> dict[str, object]:
        alerts = list(db.scalars(select(Alert).where(Alert.status == "ACTIVE")))
        grouped: dict[str, list[Alert]] = {}
        for alert in alerts:
            grouped.setdefault(alert.symbol.strip().upper(), []).append(alert)

        prices: dict[str, float] = {}
        errors: dict[str, str] = {}
        triggered: list[str] = []
        for symbol, symbol_alerts in grouped.items():
            try:
                candles = self.market_data.get_candles(symbol, "5m", 1)
                if not candles:
                    raise MarketDataUnavailable("Provider returned no latest candle")
                price = float(candles[-1].close)
                prices[symbol] = price
            except (MarketDataUnavailable, ValueError) as error:
                errors[symbol] = str(error)
                continue

            for alert in symbol_alerts:
                target = float(alert.target_price)
                qualifies = (alert.condition == "ABOVE" and price >= target) or (alert.condition == "BELOW" and price <= target)
                if qualifies:
                    alert.status = "TRIGGERED"
                    alert.triggered_at = datetime.now(timezone.utc)
                    triggered.append(str(alert.id))

        if triggered:
            db.commit()
        return {"alerts_checked": len(alerts), "symbols_checked": len(prices), "prices": prices, "triggered": triggered, "errors": errors}
