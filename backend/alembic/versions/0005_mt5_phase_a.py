"""MT5 bridge Phase A foundation

Revision ID: 0005_mt5_phase_a
Revises: 0004_swing_trade_plans
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_mt5_phase_a"; down_revision = "0004_swing_trade_plans"; branch_labels = None; depends_on = None
uuid = postgresql.UUID(as_uuid=True); money = sa.Numeric(20, 8)
def common(): return [sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]

def upgrade() -> None:
    op.create_table("trading_accounts", *common(), sa.Column("external_account_key", sa.String(64), nullable=False, unique=True), sa.Column("label", sa.String(100), nullable=False), sa.Column("broker", sa.String(100), nullable=False), sa.Column("login_last4", sa.String(4), nullable=False), sa.Column("server", sa.String(120), nullable=False), sa.Column("connection_type", sa.String(30), nullable=False, server_default="WINDOWS_BRIDGE"), sa.Column("status", sa.String(20), nullable=False, server_default="DISCONNECTED"), sa.Column("currency", sa.String(10)), sa.Column("balance", money), sa.Column("equity", money), sa.Column("margin", money), sa.Column("free_margin", money), sa.Column("leverage", sa.Integer()), sa.Column("last_synced_at", sa.DateTime(timezone=True)), sa.Column("last_error", sa.Text()))
    op.create_table("mt5_positions", *common(), sa.Column("account_id", uuid, sa.ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True), sa.Column("position_ticket", sa.BigInteger(), nullable=False), sa.Column("symbol", sa.String(30), nullable=False), sa.Column("direction", sa.String(4), nullable=False), sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False), sa.Column("entry_price", money, nullable=False), sa.Column("current_price", money), sa.Column("volume", money, nullable=False), sa.Column("stop_loss", money), sa.Column("take_profit", money), sa.Column("floating_pnl", money), sa.Column("comment", sa.Text(), nullable=False, server_default=""), sa.Column("magic", sa.BigInteger()), sa.Column("is_open", sa.Boolean(), nullable=False, server_default=sa.true()), sa.UniqueConstraint("account_id", "position_ticket", name="uq_mt5_position"))
    op.create_table("mt5_deals", *common(), sa.Column("account_id", uuid, sa.ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True), sa.Column("deal_ticket", sa.BigInteger(), nullable=False), sa.Column("order_ticket", sa.BigInteger()), sa.Column("position_ticket", sa.BigInteger(), index=True), sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False), sa.Column("symbol", sa.String(30), nullable=False), sa.Column("direction", sa.String(4), nullable=False), sa.Column("entry_kind", sa.String(20), nullable=False), sa.Column("volume", money, nullable=False), sa.Column("price", money, nullable=False), sa.Column("profit", money, nullable=False), sa.Column("commission", money, nullable=False), sa.Column("swap", money, nullable=False), sa.Column("fee", money, nullable=False), sa.Column("comment", sa.Text(), nullable=False, server_default=""), sa.Column("magic", sa.BigInteger()), sa.UniqueConstraint("account_id", "deal_ticket", name="uq_mt5_deal"))
    op.create_table("mt5_sync_runs", *common(), sa.Column("account_id", uuid, sa.ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True), sa.Column("status", sa.String(20), nullable=False), sa.Column("positions_received", sa.Integer(), nullable=False, server_default="0"), sa.Column("deals_received", sa.Integer(), nullable=False, server_default="0"), sa.Column("new_deals", sa.Integer(), nullable=False, server_default="0"), sa.Column("cursor_ticket", sa.BigInteger()), sa.Column("message", sa.Text(), nullable=False, server_default=""))
    for table in ("trading_accounts", "mt5_positions", "mt5_deals", "mt5_sync_runs"): op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")

def downgrade() -> None:
    op.drop_table("mt5_sync_runs"); op.drop_table("mt5_deals"); op.drop_table("mt5_positions"); op.drop_table("trading_accounts")
