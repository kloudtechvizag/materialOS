"""laboratory storage & chain of custody

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-09-14 16:00:00.000000

Adds lab_storage_locations (a self-referencing hierarchy -- freezer ->
shelf -> rack -> box) and lab_custody_events (an append-only chain-of-
custody ledger -- rows are only ever inserted, never updated or
deleted), plus a nullable current_location_id denormalized pointer on
lab_samples. Standard per-tenant RLS + audit_trg on both new tables.
See ADR-021's storage addendum.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['lab_storage_locations', 'lab_custody_events']


def _rls_and_audit(table: str) -> None:
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
        'lab_storage_locations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('parent_location_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('location_type', sa.String(length=20), nullable=False),
        sa.Column('temperature_c', sa.Numeric(5, 1), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_lab_storage_locations_company_code'),
    )
    op.create_foreign_key('fk_lab_storage_locations_parent', 'lab_storage_locations', 'lab_storage_locations', ['parent_location_id'], ['id'], ondelete='SET NULL')

    op.create_table(
        'lab_custody_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sample_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_samples.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(length=20), nullable=False),
        sa.Column('from_location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_storage_locations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_storage_locations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('performed_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('performed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    for table in TABLES:
        _rls_and_audit(table)

    op.add_column('lab_samples', sa.Column('current_location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_storage_locations.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_lab_samples_current_location_id', 'lab_samples', ['current_location_id'])


def downgrade() -> None:
    op.drop_index('ix_lab_samples_current_location_id', table_name='lab_samples')
    op.drop_column('lab_samples', 'current_location_id')

    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
    op.drop_table('lab_custody_events')
    op.drop_constraint('fk_lab_storage_locations_parent', 'lab_storage_locations', type_='foreignkey')
    op.drop_table('lab_storage_locations')
