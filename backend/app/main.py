from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from .config import settings
from .database import SessionLocal, engine, get_db
from .market_schemas import CandleOut, MarketDataStatusOut
from .models import Alert, Strategy, Trade
from .schemas import AlertIn, AlertOut, StrategyIn, StrategyOut, TradeIn, TradeOut
from .services.market_data import MT5MarketDataProvider, MarketDataService, MarketDataUnavailable, TwelveDataMarketDataProvider
from .services.alert_monitor import AlertMonitor

def configured_market_provider():
    provider_name = settings.market_data_provider.strip().lower()
    if provider_name == "mt5":
        return MT5MarketDataProvider()
    if provider_name in {"http", "twelve_data", "twelvedata"}:
        return TwelveDataMarketDataProvider(settings.market_data_api_key)
    raise RuntimeError(f"Unsupported MARKET_DATA_PROVIDER: {settings.market_data_provider}")

market_data = MarketDataService(configured_market_provider())
alert_monitor = AlertMonitor(market_data)

async def alert_poll_loop(stop: asyncio.Event):
    while True:
        try:
            await asyncio.wait_for(stop.wait(), timeout=max(settings.alert_poll_seconds, 60))
            return
        except asyncio.TimeoutError:
            try:
                with SessionLocal() as db:
                    await asyncio.to_thread(alert_monitor.check, db)
            except Exception:
                # The next interval retries; provider/database errors must not stop the API.
                continue

@asynccontextmanager
async def lifespan(_: FastAPI):
    stop = asyncio.Event()
    task = asyncio.create_task(alert_poll_loop(stop)) if settings.alert_monitor_enabled else None
    yield
    stop.set()
    if task:
        await task

app = FastAPI(title="RTR-TradeScope API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_url], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def calculate(data: TradeIn):
    unit_risk = abs(data.entry_price - data.stop_loss); size = data.position_size
    planned = (data.take_profit - data.entry_price if data.direction == "BUY" else data.entry_price - data.take_profit) if data.take_profit else Decimal(0)
    actual = (data.exit_price - data.entry_price if data.direction == "BUY" else data.entry_price - data.exit_price) if data.exit_price else Decimal(0)
    return {"risk": unit_risk * size, "potential_reward": abs(planned) * size, "risk_reward_ratio": abs(planned) / unit_risk if unit_risk else 0, "realized_r": actual / unit_risk if data.status == "Closed" and data.exit_price and unit_risk else 0, "pnl": actual * size if data.status == "Closed" and data.exit_price else 0}

def one(db: Session, model, item_id):
    item = db.get(model, item_id)
    if not item: raise HTTPException(404, "Record not found")
    return item
def save(db: Session, item): db.add(item); db.commit(); db.refresh(item); return item

@app.get("/api/health")
def health():
    try:
        with engine.connect() as connection: connection.execute(text("SELECT 1"))
        return {"status": "healthy", "service": "rtr-tradescope-api", "database": "connected"}
    except SQLAlchemyError: raise HTTPException(503, {"status": "degraded", "service": "rtr-tradescope-api", "database": "unavailable"})

@app.get("/api/market/status", response_model=MarketDataStatusOut)
def market_status():
    connected, detail = market_data.provider.availability()
    return {"provider": market_data.provider.name, "connected": connected, "symbols": market_data.provider.supported_symbols, "detail": detail}

@app.get("/api/market/candles", response_model=list[CandleOut])
def market_candles(
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    limit: int = 500,
    start: datetime | None = None,
    end: datetime | None = None,
):
    normalized_symbol = symbol.strip().upper()
    normalized_timeframe = {"5M": "5m", "15M": "15m", "1H": "1H", "4H": "4H"}.get(timeframe.strip().upper())
    if normalized_symbol not in market_data.provider.supported_symbols:
        raise HTTPException(422, f"Unsupported symbol. Choose one of: {', '.join(market_data.provider.supported_symbols)}")
    if normalized_timeframe is None:
        raise HTTPException(422, "Unsupported timeframe. Choose one of: 5m, 15m, 1H, 4H")
    if limit < 1 or limit > 2000:
        raise HTTPException(422, "limit must be between 1 and 2000")
    if start and end and start >= end:
        raise HTTPException(422, "start must be earlier than end")
    try:
        return market_data.get_candles(normalized_symbol, normalized_timeframe, limit, start, end)
    except MarketDataUnavailable as error:
        raise HTTPException(503, {"provider": market_data.provider.name, "connected": False, "detail": str(error)}) from error

@app.get("/api/trades", response_model=list[TradeOut])
def trades(db: Session = Depends(get_db)): return db.scalars(select(Trade).order_by(Trade.trade_date.desc())).all()
@app.post("/api/trades", response_model=TradeOut, status_code=201)
def create_trade(data: TradeIn, db: Session = Depends(get_db)): return save(db, Trade(**data.model_dump(), **calculate(data)))
@app.get("/api/trades/{item_id}", response_model=TradeOut)
def get_trade(item_id: str, db: Session = Depends(get_db)): return one(db, Trade, item_id)
@app.put("/api/trades/{item_id}", response_model=TradeOut)
def update_trade(item_id: str, data: TradeIn, db: Session = Depends(get_db)):
    item = one(db, Trade, item_id)
    for key, value in {**data.model_dump(), **calculate(data)}.items(): setattr(item, key, value)
    return save(db, item)
@app.delete("/api/trades/{item_id}", status_code=204)
def delete_trade(item_id: str, db: Session = Depends(get_db)): db.delete(one(db, Trade, item_id)); db.commit()

def crud_routes(path, model, input_schema, output_schema):
    def list_items(db: Session = Depends(get_db)): return db.scalars(select(model).order_by(model.created_at.desc())).all()
    def create_item(data, db: Session = Depends(get_db)): return save(db, model(**data.model_dump()))
    def get_item(item_id: str, db: Session = Depends(get_db)): return one(db, model, item_id)
    def update_item(item_id: str, data, db: Session = Depends(get_db)):
        item = one(db, model, item_id)
        for key, value in data.model_dump().items(): setattr(item, key, value)
        return save(db, item)
    def delete_item(item_id: str, db: Session = Depends(get_db)): db.delete(one(db, model, item_id)); db.commit()
    create_item.__annotations__["data"] = input_schema
    update_item.__annotations__["data"] = input_schema
    app.add_api_route(f"/api/{path}", list_items, methods=["GET"], response_model=list[output_schema])
    app.add_api_route(f"/api/{path}", create_item, methods=["POST"], response_model=output_schema, status_code=201)
    app.add_api_route(f"/api/{path}/{{item_id}}", get_item, methods=["GET"], response_model=output_schema)
    app.add_api_route(f"/api/{path}/{{item_id}}", update_item, methods=["PUT"], response_model=output_schema)
    app.add_api_route(f"/api/{path}/{{item_id}}", delete_item, methods=["DELETE"], status_code=204)
crud_routes("strategies", Strategy, StrategyIn, StrategyOut)
@app.post("/api/alerts/check")
def check_alerts(db: Session = Depends(get_db)):
    return alert_monitor.check(db)
crud_routes("alerts", Alert, AlertIn, AlertOut)

@app.get("/api/analytics/summary")
def analytics_summary(db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).where(Trade.status == "Closed")).all(); wins = [r for r in rows if r.pnl > 0]; losses = [r for r in rows if r.pnl < 0]
    gp = sum((r.pnl for r in wins), Decimal(0)); gl = abs(sum((r.pnl for r in losses), Decimal(0)))
    return {"closed_trades": len(rows), "wins": len(wins), "losses": len(losses), "win_rate": len(wins) / len(rows) * 100 if rows else 0, "net_pnl": gp - gl, "profit_factor": gp / gl if gl else None, "average_realized_r": sum((r.realized_r for r in rows), Decimal(0)) / len(rows) if rows else 0}
@app.get("/api/analytics/performance")
def performance(db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).where(Trade.status == "Closed").order_by(Trade.trade_date)).all(); pnl = Decimal(0); result = []
    for row in rows: pnl += row.pnl; result.append({"date": row.trade_date, "pnl": pnl})
    return result
def grouped(field, db): return [{"name": name, "trades": count, "pnl": pnl} for name, count, pnl in db.execute(select(field, func.count(Trade.id), func.sum(Trade.pnl)).where(Trade.status == "Closed").group_by(field)).all()]
@app.get("/api/analytics/instruments")
def instruments(db: Session = Depends(get_db)): return grouped(Trade.symbol, db)
@app.get("/api/analytics/sessions")
def sessions(db: Session = Depends(get_db)): return grouped(Trade.session, db)
@app.get("/api/analytics/strategies")
def strategy_analytics(db: Session = Depends(get_db)): return grouped(Trade.strategy_name, db)
