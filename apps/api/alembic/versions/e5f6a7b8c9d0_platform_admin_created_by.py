"""platform admin created_by_admin_id

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-14 04:00:00.000000

ADR-020's admin-creation UI (POST /platform/admins): every in-app-created
admin records who created them, self-referencing platform_admins. NULL
stays reserved for the very first admin, bootstrapped out-of-band via
scripts/create_platform_admin.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'platform_admins',
        sa.Column('created_by_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('platform_admins.id', ondelete='SET NULL'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('platform_admins', 'created_by_admin_id')
