from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class ORMModel(BaseModel): model_config = ConfigDict(from_attributes=True)
class TradingAccountCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100); broker: str = Field(min_length=1, max_length=100); login: str = Field(pattern=r"^\d{4,20}$"); server: str = Field(min_length=1, max_length=120); connection_type: Literal["WINDOWS_BRIDGE"] = "WINDOWS_BRIDGE"
class TradingAccountOut(ORMModel):
    id: UUID; label: str; broker: str; login_masked: str; server: str; connection_type: str; status: str; currency: str | None; balance: Decimal | None; equity: Decimal | None; margin: Decimal | None; free_margin: Decimal | None; leverage: int | None; last_synced_at: datetime | None; last_error: str | None
class BridgeAccount(BaseModel):
    account_key: str = Field(pattern=r"^[a-f0-9]{64}$"); label: str = Field(min_length=1, max_length=100); broker: str = Field(min_length=1, max_length=100); login_last4: str = Field(pattern=r"^\d{4}$"); server: str = Field(min_length=1, max_length=120); currency: str | None = Field(None, max_length=10); balance: Decimal | None = None; equity: Decimal | None = None; margin: Decimal | None = None; free_margin: Decimal | None = None; leverage: int | None = Field(None, ge=0)
class BridgePosition(BaseModel):
    position_ticket: int = Field(gt=0); symbol: str = Field(min_length=1, max_length=30); direction: Literal["BUY", "SELL"]; opened_at: datetime; entry_price: Decimal = Field(gt=0); current_price: Decimal | None = Field(None, gt=0); volume: Decimal = Field(gt=0); stop_loss: Decimal | None = Field(None, ge=0); take_profit: Decimal | None = Field(None, ge=0); floating_pnl: Decimal | None = None; comment: str = ""; magic: int | None = None
class BridgeDeal(BaseModel):
    deal_ticket: int = Field(gt=0); order_ticket: int | None = Field(None, gt=0); position_ticket: int | None = Field(None, gt=0); executed_at: datetime; symbol: str = Field(min_length=1, max_length=30); direction: Literal["BUY", "SELL"]; entry_kind: Literal["IN", "OUT", "INOUT", "OUT_BY", "OTHER"]; volume: Decimal = Field(ge=0); price: Decimal = Field(gt=0); profit: Decimal = 0; commission: Decimal = 0; swap: Decimal = 0; fee: Decimal = 0; comment: str = ""; magic: int | None = None
class BridgeSyncIn(BaseModel):
    account: BridgeAccount; terminal_connected: bool; account_connected: bool; terminal_version: str | None = Field(None, max_length=50); positions: list[BridgePosition] = Field(default_factory=list); deals: list[BridgeDeal] = Field(default_factory=list); cursor_ticket: int | None = Field(None, ge=0); synced_at: datetime
class BridgeHeartbeatIn(BaseModel):
    account_key: str = Field(pattern=r"^[a-f0-9]{64}$"); terminal_connected: bool; account_connected: bool; error: str | None = Field(None, max_length=300); synced_at: datetime
class MT5PositionOut(BridgePosition, ORMModel): id: UUID; account_id: UUID; is_open: bool; updated_at: datetime
class MT5DealOut(BridgeDeal, ORMModel): id: UUID; account_id: UUID; created_at: datetime
class MT5SyncRunOut(ORMModel):
    id: UUID; account_id: UUID; status: str; positions_received: int; deals_received: int; new_deals: int; cursor_ticket: int | None; message: str; created_at: datetime
