"""impersonation sessions

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-14 03:00:00.000000

Platform-root, like `platform_admins` and `tenants` themselves: this
records that one platform admin issued themselves a short-lived
impersonation token (app/security.py's create_impersonation_token) for
one tenant user, so it spans the tenant boundary by nature and has no
tenant_id to scope a normal RLS policy to. See ADR-020.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'impersonation_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('platform_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('platform_admins.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('impersonated_tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('impersonated_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    # No RLS: platform-root data, like `platform_admins` and `tenants`.


def downgrade() -> None:
    op.drop_table('impersonation_sessions')
