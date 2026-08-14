from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

class ORMModel(BaseModel): model_config = ConfigDict(from_attributes=True)
class TradeIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=30); direction: Literal["BUY", "SELL"]
    entry_price: Decimal = Field(gt=0); stop_loss: Decimal = Field(gt=0); take_profit: Decimal | None = Field(None, gt=0); exit_price: Decimal | None = Field(None, gt=0)
    position_size: Decimal = Field(ge=0); trade_date: date; closed_at: datetime | None = None; session: str; strategy_id: UUID | None = None; strategy_name: str = ""
    status: Literal["Planned", "Open", "Closed"]; result: Literal["Win", "Loss", "Breakeven", "Pending"]; notes: str = ""; screenshot_url: str | None = None
    @model_validator(mode="after")
    def prices(self):
        if self.direction == "BUY" and self.stop_loss >= self.entry_price: raise ValueError("BUY stop loss must be below entry")
        if self.direction == "SELL" and self.stop_loss <= self.entry_price: raise ValueError("SELL stop loss must be above entry")
        if self.take_profit and ((self.direction == "BUY" and self.take_profit <= self.entry_price) or (self.direction == "SELL" and self.take_profit >= self.entry_price)): raise ValueError("Take profit is on the wrong side of entry")
        return self
class TradeOut(TradeIn, ORMModel):
    id: UUID; risk: Decimal; potential_reward: Decimal; risk_reward_ratio: Decimal; realized_r: Decimal; pnl: Decimal; created_at: datetime; updated_at: datetime
class StrategyIn(BaseModel):
    name: str = Field(min_length=1, max_length=150); description: str = ""; preferred_markets: str = ""; preferred_session: str = "Other"; risk_rules: str = ""; entry_rules: str = ""; exit_rules: str = ""; notes: str = ""
class StrategyOut(StrategyIn, ORMModel): id: UUID; created_at: datetime; updated_at: datetime
class AlertIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=30); target_price: Decimal = Field(gt=0); condition: Literal["ABOVE", "BELOW"]; note: str = ""; status: Literal["ACTIVE", "TRIGGERED", "DISABLED"] = "ACTIVE"; triggered_at: datetime | None = None
    source: str | None = Field(None, max_length=50); source_timeframe: str | None = Field(None, max_length=10); source_signal: str | None = Field(None, max_length=50); confluence_score: int | None = Field(None, ge=0, le=5)
class AlertOut(AlertIn, ORMModel): id: UUID; created_at: datetime; updated_at: datetime
