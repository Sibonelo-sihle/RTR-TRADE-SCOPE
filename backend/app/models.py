from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
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
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    source_timeframe: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    source_signal: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    confluence_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

class SwingState(Timestamped, Base):
    __tablename__ = "swing_states"
    __table_args__ = (UniqueConstraint("symbol", "direction", "htf_zone_id", name="uq_swing_setup"),)
    symbol: Mapped[str] = mapped_column(String(30), index=True)
    direction: Mapped[str] = mapped_column(String(4))
    htf_zone_id: Mapped[str] = mapped_column(String(100))
    htf_timeframe: Mapped[str] = mapped_column(String(10))
    signal_timestamp: Mapped[int] = mapped_column(BigInteger)
    entry_timeframe: Mapped[str] = mapped_column(String(10))
    score: Mapped[int] = mapped_column(Integer)
    zone_type: Mapped[str] = mapped_column(String(10))
    zone_lower: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    zone_upper: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    four_h_bias: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    four_h_zone_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    one_h_setup_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    atr_buffer: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    stop: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    tp1: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    tp2: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    tp1_structure_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tp2_structure_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rr_to_tp1: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 6), nullable=True)
    rr_to_tp2: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 6), nullable=True)
