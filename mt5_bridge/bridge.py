"""Read-only Windows bridge from an authenticated MT5 terminal to RTR."""
from __future__ import annotations
import hashlib, json, os, platform, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

if platform.system() != "Windows": raise SystemExit("MT5_NOT_INSTALLED: the official connector requires Windows.")
try: import MetaTrader5 as mt5
except ImportError: raise SystemExit("MT5_NOT_INSTALLED: install the MetaTrader5 Python package.")

STATE_PATH = Path(os.getenv("RTR_BRIDGE_STATE_PATH", "rtr_mt5_bridge_state.json"))
API_URL = os.environ["RTR_API_URL"].rstrip("/")
TOKEN = os.environ["RTR_BRIDGE_TOKEN"]
TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH")

def iso(epoch: int): return datetime.fromtimestamp(epoch, timezone.utc).isoformat()
def optional_price(value): return None if not value else value
def load_state():
    try: return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError): return {}
def save_state(value): STATE_PATH.parent.mkdir(parents=True, exist_ok=True); STATE_PATH.write_text(json.dumps(value), encoding="utf-8")
def entry_kind(value):
    return {mt5.DEAL_ENTRY_IN: "IN", mt5.DEAL_ENTRY_OUT: "OUT", mt5.DEAL_ENTRY_INOUT: "INOUT", mt5.DEAL_ENTRY_OUT_BY: "OUT_BY"}.get(value, "OTHER")
def direction(value): return "BUY" if value in {mt5.POSITION_TYPE_BUY, mt5.DEAL_TYPE_BUY} else "SELL"

def snapshot():
    if TERMINAL_PATH and not Path(TERMINAL_PATH).is_file(): raise RuntimeError("MT5_NOT_INSTALLED: MT5_TERMINAL_PATH does not point to terminal64.exe")
    initialized = mt5.initialize(TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
    if not initialized: raise RuntimeError(f"MT5_TERMINAL_CLOSED: terminal could not be started or reached ({mt5.last_error()})")
    try:
        account = mt5.account_info()
        if account is None: raise RuntimeError(f"NO_ACCOUNT_LOGGED_IN: open MT5 and log in manually ({mt5.last_error()})")
        terminal = mt5.terminal_info()
        if terminal is None: raise RuntimeError(f"MT5 terminal status unavailable: {mt5.last_error()}")
        if not terminal.connected: raise RuntimeError("BROKER_DISCONNECTED: MT5 terminal is open but the broker connection is offline")
        positions = mt5.positions_get()
        if positions is None: raise RuntimeError(f"MT5 positions unavailable: {mt5.last_error()}")
        state = load_state(); history_days = max(1, int(os.getenv("RTR_HISTORY_DAYS", "30")))
        start = datetime.fromtimestamp(state.get("last_sync_epoch", 0), timezone.utc) - timedelta(minutes=5) if state.get("last_sync_epoch") else datetime.now(timezone.utc) - timedelta(days=history_days)
        end = datetime.now(timezone.utc); deals = mt5.history_deals_get(start, end)
        if deals is None: raise RuntimeError(f"MT5 deal history unavailable: {mt5.last_error()}")
        server = str(account.server); login = str(account.login)
        account_key = hashlib.sha256(f"{server.strip().lower()}:{login}".encode()).hexdigest()
        payload = {"account": {"account_key": account_key, "label": os.getenv("RTR_ACCOUNT_LABEL", f"MT5 {login[-4:]}"), "broker": os.getenv("RTR_BROKER", str(account.company or "MetaTrader 5")), "login_last4": login[-4:], "server": server, "currency": account.currency or None, "balance": account.balance, "equity": account.equity, "margin": account.margin, "free_margin": account.margin_free, "leverage": account.leverage}, "terminal_connected": bool(terminal.connected), "account_connected": bool(terminal.connected and account.login), "terminal_version": ".".join(map(str, mt5.version() or ())), "positions": [{"position_ticket": item.ticket, "symbol": item.symbol, "direction": direction(item.type), "opened_at": iso(item.time), "entry_price": item.price_open, "current_price": optional_price(item.price_current), "volume": item.volume, "stop_loss": optional_price(item.sl), "take_profit": optional_price(item.tp), "floating_pnl": item.profit, "comment": item.comment or "", "magic": item.magic} for item in positions], "deals": [{"deal_ticket": item.ticket, "order_ticket": item.order or None, "position_ticket": item.position_id or None, "executed_at": iso(item.time), "symbol": item.symbol, "direction": direction(item.type), "entry_kind": entry_kind(item.entry), "volume": item.volume, "price": item.price, "profit": item.profit, "commission": item.commission, "swap": item.swap, "fee": item.fee, "comment": item.comment or "", "magic": item.magic} for item in deals if item.symbol and item.price > 0], "cursor_ticket": max((item.ticket for item in deals), default=state.get("cursor_ticket")), "synced_at": end.isoformat()}
        return payload, {"last_sync_epoch": int(end.timestamp()), "cursor_ticket": payload["cursor_ticket"], "account_key": account_key}
    finally: mt5.shutdown()

def push(payload):
    request = Request(f"{API_URL}/api/mt5/bridge/sync", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "X-MT5-Bridge-Token": TOKEN}, method="POST")
    try:
        with urlopen(request, timeout=30) as response: return json.loads(response.read())
    except HTTPError as error:
        if error.code == 401: raise RuntimeError("BRIDGE_TOKEN_INVALID: Render rejected the bridge token") from error
        raise RuntimeError(f"RTR_UPLOAD_FAILED: backend returned HTTP {error.code}") from error
    except URLError as error: raise RuntimeError("NETWORK_UNAVAILABLE: RTR backend could not be reached") from error
def push_offline(state):
    if not state.get("account_key"): return
    request = Request(f"{API_URL}/api/mt5/bridge/heartbeat", data=json.dumps({"account_key": state["account_key"], "terminal_connected": False, "account_connected": False, "error": "MT5 terminal or broker connection unavailable", "synced_at": datetime.now(timezone.utc).isoformat()}).encode(), headers={"Content-Type": "application/json", "X-MT5-Bridge-Token": TOKEN}, method="POST")
    with urlopen(request, timeout=15) as response: response.read()

if __name__ == "__main__":
    try:
        payload, state = snapshot(); result = push(payload); save_state(state)
        print("MT5 terminal: CONNECTED")
        print(f"Account: ****{payload['account']['login_last4']}")
        print(f"Broker: {payload['account']['broker']}")
        print(f"Server: {payload['account']['server']}")
        print(f"Open positions: {result['positions_received']}")
        print(f"Deals received: {result['deals_received']}")
        print(f"New deals: {result['new_deals']}")
        print("RTR upload: SUCCESS")
        print(f"Last sync cursor: {state.get('cursor_ticket') or 'none'}")
    except Exception as error:
        try: push_offline(load_state())
        except Exception: pass
        print(f"RTR MT5 sync failed: {error}", file=sys.stderr); raise SystemExit(1)
