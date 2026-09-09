"""add supplier category

Revision ID: dc319c49d45d
Revises: d2a6f813c95b
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "dc319c49d45d"
down_revision = "d2a6f813c95b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("suppliers", sa.Column("category", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("suppliers", "category")
