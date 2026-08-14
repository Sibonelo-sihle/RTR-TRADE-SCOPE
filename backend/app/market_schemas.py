from __future__ import annotations

from pydantic import BaseModel


class CandleOut(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketDataStatusOut(BaseModel):
    provider: str
    connected: bool
    symbols: list[str]
    detail: str | None = None
