"""laboratory QC subsystem (blanks/controls/duplicates)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-14 07:00:00.000000

Adds qc_reference_samples (one control/blank per test, with its own
acceptance range) and qc_runs (a real recorded QC execution -- blank/
control against the reference sample's range, or duplicate against the
original result via RPD), plus duplicate_rpd_limit_percent on
lab_test_definitions. Standard per-tenant RLS + audit_trg on both new
tables, same treatment as every other real business record in this
domain (see ADR-021).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['qc_reference_samples', 'qc_runs']


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
    op.add_column('lab_test_definitions', sa.Column('duplicate_rpd_limit_percent', sa.Numeric(6, 2), nullable=True))

    op.create_table(
        'qc_reference_samples',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('test_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_definitions.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('qc_type', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('lot_number', sa.String(length=50), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('expected_low', sa.Numeric(18, 4), nullable=True),
        sa.Column('expected_high', sa.Numeric(18, 4), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'qc_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('test_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_definitions.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('qc_type', sa.String(length=20), nullable=False),
        sa.Column('reference_sample_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('qc_reference_samples.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('source_test_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_orders.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('result_value', sa.String(length=500), nullable=False),
        sa.Column('numeric_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('rpd_percent', sa.Numeric(6, 2), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('performed_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('performed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    for table in TABLES:
        _rls_and_audit(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
    op.drop_table('qc_runs')
    op.drop_table('qc_reference_samples')
    op.drop_column('lab_test_definitions', 'duplicate_rpd_limit_percent')
