"""add optional RTR alert source metadata

Revision ID: 0002_alert_source_metadata
Revises: 0001_initial
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_alert_source_metadata"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("alerts", sa.Column("source", sa.String(length=50), nullable=True))
    op.add_column("alerts", sa.Column("source_timeframe", sa.String(length=10), nullable=True))
    op.add_column("alerts", sa.Column("source_signal", sa.String(length=50), nullable=True))
    op.add_column("alerts", sa.Column("confluence_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("alerts", "confluence_score")
    op.drop_column("alerts", "source_signal")
    op.drop_column("alerts", "source_timeframe")
    op.drop_column("alerts", "source")
