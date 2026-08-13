from decimal import Decimal
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from .config import settings
from .database import engine, get_db
from .models import Alert, Strategy, Trade
from .schemas import AlertIn, AlertOut, StrategyIn, StrategyOut, TradeIn, TradeOut

app = FastAPI(title="RTR-TradeScope API", version="1.0.0")
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
    @app.get(f"/api/{path}", response_model=list[output_schema])
    def list_items(db: Session = Depends(get_db)): return db.scalars(select(model).order_by(model.created_at.desc())).all()
    @app.post(f"/api/{path}", response_model=output_schema, status_code=201)
    def create_item(data: input_schema, db: Session = Depends(get_db)): return save(db, model(**data.model_dump()))
    @app.get(f"/api/{path}/{{item_id}}", response_model=output_schema)
    def get_item(item_id: str, db: Session = Depends(get_db)): return one(db, model, item_id)
    @app.put(f"/api/{path}/{{item_id}}", response_model=output_schema)
    def update_item(item_id: str, data: input_schema, db: Session = Depends(get_db)):
        item = one(db, model, item_id)
        for key, value in data.model_dump().items(): setattr(item, key, value)
        return save(db, item)
    @app.delete(f"/api/{path}/{{item_id}}", status_code=204)
    def delete_item(item_id: str, db: Session = Depends(get_db)): db.delete(one(db, model, item_id)); db.commit()
crud_routes("strategies", Strategy, StrategyIn, StrategyOut)
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
