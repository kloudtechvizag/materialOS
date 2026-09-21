"""guardian customer link

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-09-27 06:00:00.000000

Adds Guardian.customer_id -- the lazy billing-party link Fee
Management (ADR-031) needs, same pattern as the existing
Guardian.user_id/Employee.user_id self-service anchors. Nullable,
additive, backward compatible.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'guardians',
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_guardians_customer_id', 'guardians', ['customer_id'])


def downgrade() -> None:
    op.drop_index('ix_guardians_customer_id', table_name='guardians')
    op.drop_column('guardians', 'customer_id')
