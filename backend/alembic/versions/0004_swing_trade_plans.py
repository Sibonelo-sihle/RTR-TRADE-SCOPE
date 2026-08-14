"""persist immutable swing trade plan levels

Revision ID: 0004_swing_trade_plans
Revises: 0003_swing_states
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_swing_trade_plans"
down_revision = "0003_swing_states"
branch_labels = None
depends_on = None

columns = (
    sa.Column("four_h_bias", sa.String(10), nullable=True), sa.Column("four_h_zone_id", sa.String(100), nullable=True),
    sa.Column("one_h_setup_id", sa.String(100), nullable=True), sa.Column("entry_price", sa.Numeric(20, 8), nullable=True),
    sa.Column("atr_buffer", sa.Numeric(20, 8), nullable=True), sa.Column("stop", sa.Numeric(20, 8), nullable=True),
    sa.Column("tp1", sa.Numeric(20, 8), nullable=True), sa.Column("tp2", sa.Numeric(20, 8), nullable=True),
    sa.Column("tp1_structure_id", sa.String(100), nullable=True), sa.Column("tp2_structure_id", sa.String(100), nullable=True),
    sa.Column("rr_to_tp1", sa.Numeric(12, 6), nullable=True), sa.Column("rr_to_tp2", sa.Numeric(12, 6), nullable=True),
)

def upgrade() -> None:
    for column in columns: op.add_column("swing_states", column)

def downgrade() -> None:
    for column in reversed(columns): op.drop_column("swing_states", column.name)
