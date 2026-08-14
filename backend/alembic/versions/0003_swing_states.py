"""persist RTR swing setup state

Revision ID: 0003_swing_states
Revises: 0002_alert_source_metadata
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_swing_states"
down_revision = "0002_alert_source_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "swing_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("symbol", sa.String(length=30), nullable=False),
        sa.Column("direction", sa.String(length=4), nullable=False),
        sa.Column("htf_zone_id", sa.String(length=100), nullable=False),
        sa.Column("htf_timeframe", sa.String(length=10), nullable=False),
        sa.Column("signal_timestamp", sa.BigInteger(), nullable=False),
        sa.Column("entry_timeframe", sa.String(length=10), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("zone_type", sa.String(length=10), nullable=False),
        sa.Column("zone_lower", sa.Numeric(20, 8), nullable=False),
        sa.Column("zone_upper", sa.Numeric(20, 8), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("symbol", "direction", "htf_zone_id", name="uq_swing_setup"),
    )
    op.create_index("ix_swing_states_symbol", "swing_states", ["symbol"])
    op.create_index("ix_swing_states_user_id", "swing_states", ["user_id"])
    op.execute("ALTER TABLE public.swing_states ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_swing_states_user_id", table_name="swing_states")
    op.drop_index("ix_swing_states_symbol", table_name="swing_states")
    op.drop_table("swing_states")
