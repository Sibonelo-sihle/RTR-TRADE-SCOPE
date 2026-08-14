from datetime import timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import MT5Deal, MT5Position, MT5SyncRun, TradingAccount
from ..mt5_schemas import BridgeHeartbeatIn, BridgeSyncIn

def account_payload(account: TradingAccount):
    return {"id": account.id, "label": account.label, "broker": account.broker, "login_masked": f"****{account.login_last4}", "server": account.server, "connection_type": account.connection_type, "status": account.status, "currency": account.currency, "balance": account.balance, "equity": account.equity, "margin": account.margin, "free_margin": account.free_margin, "leverage": account.leverage, "last_synced_at": account.last_synced_at, "last_error": account.last_error}

def ingest_mt5_sync(db: Session, payload: BridgeSyncIn):
    data = payload.account
    account = db.scalar(select(TradingAccount).where(TradingAccount.external_account_key == data.account_key))
    if not account:
        account = TradingAccount(external_account_key=data.account_key, label=data.label, broker=data.broker, login_last4=data.login_last4, server=data.server, connection_type="WINDOWS_BRIDGE")
        db.add(account); db.flush()
    for key in ("label", "broker", "login_last4", "server", "currency", "balance", "equity", "margin", "free_margin", "leverage"): setattr(account, key, getattr(data, key))
    account.status = "CONNECTED" if payload.terminal_connected and payload.account_connected else "DISCONNECTED"
    account.last_synced_at = payload.synced_at.astimezone(timezone.utc); account.last_error = None if account.status == "CONNECTED" else "MT5 terminal or broker account is unavailable"
    current_tickets = {position.position_ticket for position in payload.positions}
    if account.status == "CONNECTED":
        for existing in db.scalars(select(MT5Position).where(MT5Position.account_id == account.id, MT5Position.is_open.is_(True))):
            if existing.position_ticket not in current_tickets: existing.is_open = False
    for item in payload.positions:
        position = db.scalar(select(MT5Position).where(MT5Position.account_id == account.id, MT5Position.position_ticket == item.position_ticket))
        if not position: position = MT5Position(account_id=account.id, position_ticket=item.position_ticket); db.add(position)
        for key, value in item.model_dump().items(): setattr(position, key, value)
        position.is_open = True
    new_deals = 0
    for item in payload.deals:
        deal = db.scalar(select(MT5Deal).where(MT5Deal.account_id == account.id, MT5Deal.deal_ticket == item.deal_ticket))
        if deal: continue
        db.add(MT5Deal(account_id=account.id, **item.model_dump())); new_deals += 1
    db.add(MT5SyncRun(account_id=account.id, status="SUCCESS" if account.status == "CONNECTED" else "OFFLINE", positions_received=len(payload.positions), deals_received=len(payload.deals), new_deals=new_deals, cursor_ticket=payload.cursor_ticket, message=f"Terminal {payload.terminal_version or 'unknown'}"))
    db.commit(); db.refresh(account)
    return {"account": account_payload(account), "positions_received": len(payload.positions), "deals_received": len(payload.deals), "new_deals": new_deals}

def record_mt5_heartbeat(db: Session, payload: BridgeHeartbeatIn):
    account = db.scalar(select(TradingAccount).where(TradingAccount.external_account_key == payload.account_key))
    if not account: return None
    account.status = "CONNECTED" if payload.terminal_connected and payload.account_connected else "DISCONNECTED"; account.last_error = payload.error; account.last_synced_at = payload.synced_at.astimezone(timezone.utc)
    db.add(MT5SyncRun(account_id=account.id, status=account.status, message=payload.error or "Bridge heartbeat")); db.commit(); db.refresh(account)
    return account_payload(account)
