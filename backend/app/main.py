from __future__ import annotations

import asyncio
import hashlib
import secrets
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from .config import settings
from .database import SessionLocal, engine, get_db
from .market_schemas import CandleOut, MarketDataStatusOut
from .models import Alert, MT5Deal, MT5Position, MT5SyncRun, Strategy, SwingState, Trade, TradingAccount
from .mt5_schemas import BridgeHeartbeatIn, BridgeSyncIn, MT5DealOut, MT5PositionOut, MT5SyncRunOut, TradingAccountCreate, TradingAccountOut
from .schemas import AlertIn, AlertOut, StrategyIn, StrategyOut, SwingStateIn, SwingStateOut, TradeIn, TradeOut
from .services.market_data import MT5MarketDataProvider, MarketDataService, MarketDataUnavailable, TwelveDataMarketDataProvider
from .services.alert_monitor import AlertMonitor
from .services.mt5_sync import account_payload, ingest_mt5_sync, record_mt5_heartbeat

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

def bridge_auth(x_mt5_bridge_token: str | None = Header(None)):
    configured = (settings.mt5_bridge_token or "").strip()
    if len(configured) < 32: raise HTTPException(503, "MT5 bridge ingestion is not securely configured")
    if not x_mt5_bridge_token or not secrets.compare_digest(x_mt5_bridge_token, configured): raise HTTPException(401, "Invalid MT5 bridge credentials")

@app.get("/api/trading-accounts", response_model=list[TradingAccountOut])
def trading_accounts(db: Session = Depends(get_db)): return [account_payload(item) for item in db.scalars(select(TradingAccount).order_by(TradingAccount.created_at.desc())).all()]
@app.post("/api/trading-accounts", response_model=TradingAccountOut, status_code=201)
def create_trading_account(data: TradingAccountCreate, db: Session = Depends(get_db)):
    key = hashlib.sha256(f"{data.server.strip().lower()}:{data.login}".encode()).hexdigest()
    account = db.scalar(select(TradingAccount).where(TradingAccount.external_account_key == key))
    if not account: account = TradingAccount(external_account_key=key, label=data.label, broker=data.broker, login_last4=data.login[-4:], server=data.server, connection_type=data.connection_type, status="DISCONNECTED"); db.add(account)
    else: account.label = data.label; account.broker = data.broker; account.server = data.server
    db.commit(); db.refresh(account); return account_payload(account)
@app.get("/api/trading-accounts/{account_id}/positions", response_model=list[MT5PositionOut])
def mt5_positions(account_id: str, db: Session = Depends(get_db)): return db.scalars(select(MT5Position).where(MT5Position.account_id == account_id, MT5Position.is_open.is_(True)).order_by(MT5Position.opened_at.desc())).all()
@app.get("/api/trading-accounts/{account_id}/deals", response_model=list[MT5DealOut])
def mt5_deals(account_id: str, db: Session = Depends(get_db)): return db.scalars(select(MT5Deal).where(MT5Deal.account_id == account_id).order_by(MT5Deal.executed_at.desc()).limit(500)).all()
@app.get("/api/trading-accounts/{account_id}/sync-runs", response_model=list[MT5SyncRunOut])
def mt5_sync_runs(account_id: str, db: Session = Depends(get_db)): return db.scalars(select(MT5SyncRun).where(MT5SyncRun.account_id == account_id).order_by(MT5SyncRun.created_at.desc()).limit(20)).all()
@app.post("/api/mt5/bridge/sync", dependencies=[Depends(bridge_auth)])
def mt5_bridge_sync(payload: BridgeSyncIn, db: Session = Depends(get_db)): return ingest_mt5_sync(db, payload)
@app.post("/api/mt5/bridge/heartbeat", dependencies=[Depends(bridge_auth)])
def mt5_bridge_heartbeat(payload: BridgeHeartbeatIn, db: Session = Depends(get_db)):
    account = record_mt5_heartbeat(db, payload)
    if not account: raise HTTPException(404, "Trading account is not registered")
    return account

@app.get("/api/swings", response_model=list[SwingStateOut])
def swings(symbol: str | None = None, db: Session = Depends(get_db)):
    query = select(SwingState).order_by(SwingState.created_at.desc())
    if symbol: query = query.where(SwingState.symbol == symbol.strip().upper())
    return db.scalars(query).all()

@app.post("/api/swings", response_model=SwingStateOut)
def create_swing(data: SwingStateIn, db: Session = Depends(get_db)):
    existing = db.scalar(select(SwingState).where(SwingState.symbol == data.symbol.strip().upper(), SwingState.direction == data.direction, SwingState.htf_zone_id == data.htf_zone_id))
    if existing: return existing
    values = data.model_dump(); values["symbol"] = data.symbol.strip().upper()
    return save(db, SwingState(**values, status="ACTIVE"))

@app.put("/api/swings/{item_id}/close", response_model=SwingStateOut)
def close_swing(item_id: str, db: Session = Depends(get_db)):
    item = one(db, SwingState, item_id)
    item.status = "CLOSED"; item.closed_at = datetime.now().astimezone()
    return save(db, item)

@app.put("/api/swings/{item_id}/invalidate", response_model=SwingStateOut)
def invalidate_swing(item_id: str, db: Session = Depends(get_db)):
    item = one(db, SwingState, item_id)
    if item.status == "ACTIVE": item.status = "INVALIDATED"; item.closed_at = datetime.now().astimezone()
    return save(db, item)

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
