"""user guardian link

Revision ID: 8e8b79d6041d
Revises: c833c839b6b3
Create Date: 2026-09-28 06:00:00.000000

Adds User.guardian_id -- the real Guardian (Parent) Portal login
anchor (ADR-032), modeled directly on the existing, proven
User.customer_id mechanism (ADR-009's customer portal). Nullable,
additive, backward compatible.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '8e8b79d6041d'
down_revision: Union[str, None] = 'c833c839b6b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('guardian_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guardians.id', ondelete='CASCADE'), nullable=True),
    )
    op.create_index('ix_users_guardian_id', 'users', ['guardian_id'])


def downgrade() -> None:
    op.drop_index('ix_users_guardian_id', table_name='users')
    op.drop_column('users', 'guardian_id')
