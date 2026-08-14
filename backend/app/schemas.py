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
class SwingStateIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=30); direction: Literal["BUY", "SELL"]
    htf_zone_id: str = Field(min_length=1, max_length=100); htf_timeframe: Literal["4H", "1H"]
    signal_timestamp: int = Field(gt=0); entry_timeframe: Literal["15m", "5m"]; score: int = Field(ge=4, le=5)
    zone_type: Literal["Supply", "Demand"]; zone_lower: Decimal; zone_upper: Decimal
    four_h_bias: Literal["BULLISH", "BEARISH"]; four_h_zone_id: str = Field(min_length=1, max_length=100); one_h_setup_id: str = Field(min_length=1, max_length=100)
    entry_price: Decimal = Field(gt=0); atr_buffer: Decimal = Field(gt=0); stop: Decimal = Field(gt=0)
    tp1: Decimal | None = Field(None, gt=0); tp2: Decimal | None = Field(None, gt=0)
    tp1_structure_id: str | None = Field(None, max_length=100); tp2_structure_id: str | None = Field(None, max_length=100)
    rr_to_tp1: Decimal | None = Field(None, ge=1.5); rr_to_tp2: Decimal | None = Field(None, ge=1.5)
    @model_validator(mode="after")
    def validate_plan(self):
        if self.entry_price is None or self.stop is None: return self
        if self.direction == "BUY" and self.stop >= self.entry_price: raise ValueError("BUY stop must be below entry")
        if self.direction == "SELL" and self.stop <= self.entry_price: raise ValueError("SELL stop must be above entry")
        if self.tp1 is not None and ((self.direction == "BUY" and self.tp1 <= self.entry_price) or (self.direction == "SELL" and self.tp1 >= self.entry_price)): raise ValueError("TP1 is on the wrong side of entry")
        if self.tp2 is not None and ((self.direction == "BUY" and self.tp2 <= self.entry_price) or (self.direction == "SELL" and self.tp2 >= self.entry_price)): raise ValueError("TP2 is on the wrong side of entry")
        if (self.tp1 is None) != (self.rr_to_tp1 is None) or (self.tp2 is None) != (self.rr_to_tp2 is None): raise ValueError("Each target and R:R must be provided together")
        return self
class SwingStateOut(SwingStateIn, ORMModel):
    id: UUID; status: Literal["ACTIVE", "CLOSED", "INVALIDATED"]; closed_at: datetime | None = None; created_at: datetime; updated_at: datetime
    four_h_bias: Literal["BULLISH", "BEARISH"] | None = None; four_h_zone_id: str | None = None; one_h_setup_id: str | None = None
    entry_price: Decimal | None = None; atr_buffer: Decimal | None = None; stop: Decimal | None = None
