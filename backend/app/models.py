from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Timestamped:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Strategy(Timestamped, Base):
    __tablename__ = "strategies"
    name: Mapped[str] = mapped_column(String(150), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    preferred_markets: Mapped[str] = mapped_column(Text, default="")
    preferred_session: Mapped[str] = mapped_column(String(30), default="Other")
    risk_rules: Mapped[str] = mapped_column(Text, default="")
    entry_rules: Mapped[str] = mapped_column(Text, default="")
    exit_rules: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")

class Trade(Timestamped, Base):
    __tablename__ = "trades"
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    direction: Mapped[str] = mapped_column(String(4)); entry_price: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    stop_loss: Mapped[Decimal] = mapped_column(Numeric(20, 8)); take_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8))
    exit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8)); position_size: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    trade_date: Mapped[date] = mapped_column(Date); closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    session: Mapped[str] = mapped_column(String(30)); strategy_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("strategies.id", ondelete="SET NULL"))
    strategy_name: Mapped[str] = mapped_column(String(150), default=""); status: Mapped[str] = mapped_column(String(20)); result: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str] = mapped_column(Text, default=""); screenshot_url: Mapped[Optional[str]] = mapped_column(Text)
    risk: Mapped[Decimal] = mapped_column(Numeric(20, 8)); potential_reward: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    risk_reward_ratio: Mapped[Decimal] = mapped_column(Numeric(20, 8)); realized_r: Mapped[Decimal] = mapped_column(Numeric(20, 8)); pnl: Mapped[Decimal] = mapped_column(Numeric(20, 8))

class Alert(Timestamped, Base):
    __tablename__ = "alerts"
    symbol: Mapped[str] = mapped_column(String(30), index=True); target_price: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    condition: Mapped[str] = mapped_column(String(10)); note: Mapped[str] = mapped_column(Text, default=""); status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
