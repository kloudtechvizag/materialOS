"""seed all industry profiles in database migration

Revision ID: fa0b1c2d3e4f
Revises: f9a0b1c2d3e4
Create Date: 2026-09-27 15:10:00.000000

Guarantees that all 27 industry profile engines exist directly in the database
upon running alembic upgrade head, ensuring fresh stacks and restarts always have
the complete catalog immediately populated.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session
from app.services.industry import ensure_industry_profile_catalog

revision: str = 'fa0b1c2d3e4f'
down_revision: Union[str, None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    ensure_industry_profile_catalog(session)
    session.flush()


def downgrade() -> None:
    pass
