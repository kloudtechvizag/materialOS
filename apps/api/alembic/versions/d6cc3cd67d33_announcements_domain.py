"""announcements domain

Revision ID: d6cc3cd67d33
Revises: 8e8b79d6041d
Create Date: 2026-09-29 06:00:00.000000

Communication Center (spec sec20): staff-authored announcements
targeted at the whole school, a class, or a section, plus per-guardian
read tracking. Standard per-tenant RLS + audit_trg on both tables.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd6cc3cd67d33'
down_revision: Union[str, None] = '8e8b79d6041d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['announcements', 'announcement_reads']


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON {table}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )


def upgrade() -> None:
    op.create_table(
        'announcements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.String(length=4000), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_school_class_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('school_classes.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('target_section_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sections.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('published_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('expires_at', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'announcement_reads',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('guardian_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guardians.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'announcement_id', 'guardian_id', name='uq_announcement_reads_guardian'),
    )

    for table in TABLES:
        _rls(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.drop_table(table)
