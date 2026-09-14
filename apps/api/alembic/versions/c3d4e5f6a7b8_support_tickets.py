"""support tickets

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-14 01:00:00.000000

Tenant-scoped (a tenant user only ever sees their own tenant's tickets)
but the platform console needs a real global inbox across every tenant
-- ticket volume is naturally sparse, unlike the tenant directory or
audit_log, so "triage every open ticket" is the actual primary use
case, not an edge case a per-tenant loop could paper over.

These are the only two tables in the schema whose RLS policy has a
platform-bypass clause -- deliberately narrow (this migration adds it
to exactly these two tables, does not touch any existing policy) and
gated on a GUC (app.platform_context) that only get_platform_db's
callers ever set to true. See app/db.py's set_platform_context and
ADR-020.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('priority', sa.String(length=10), nullable=False, server_default='normal'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'support_ticket_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('support_tickets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('author_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('author_platform_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('platform_admins.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    for table in ('support_tickets', 'support_ticket_messages'):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
                OR NULLIF(current_setting('app.platform_context', true), '') = 'true'
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
                OR NULLIF(current_setting('app.platform_context', true), '') = 'true'
            )
            """
        )


def downgrade() -> None:
    op.drop_table('support_ticket_messages')
    op.drop_table('support_tickets')
