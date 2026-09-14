"""laboratory domain (industry #25)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-14 06:00:00.000000

The real walking skeleton from the LIMS master prompt: sample types,
containers, test catalog, samples, test orders, results, and versioned
reports. Standard per-tenant RLS on every table (no platform-bypass
clause needed -- this is ordinary tenant business data, not a
cross-tenant support/admin concern like support_tickets). All seven
get the audit_trg trigger: every one is a human-driven business record
worth a diff, the same treatment as customers/items/suppliers, not an
append-only ledger like stock_ledger.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    'lab_sample_types', 'lab_containers', 'lab_test_definitions',
    'lab_samples', 'lab_test_orders', 'lab_results', 'lab_reports',
]


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
        'lab_sample_types',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_lab_sample_types_company_code'),
    )

    op.create_table(
        'lab_containers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_lab_containers_company_code'),
    )

    op.create_table(
        'lab_test_definitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('sample_type_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_sample_types.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('method', sa.String(length=200), nullable=True),
        sa.Column('result_type', sa.String(length=20), nullable=False, server_default='quantitative'),
        sa.Column('unit', sa.String(length=30), nullable=True),
        sa.Column('reference_range_low', sa.Numeric(18, 4), nullable=True),
        sa.Column('reference_range_high', sa.Numeric(18, 4), nullable=True),
        sa.Column('critical_low', sa.Numeric(18, 4), nullable=True),
        sa.Column('critical_high', sa.Numeric(18, 4), nullable=True),
        sa.Column('turnaround_hours', sa.Integer(), nullable=True),
        sa.Column('standard_price', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_lab_test_definitions_company_code'),
    )

    op.create_table(
        'lab_samples',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('branch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sample_number', sa.String(length=40), nullable=False, index=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sample_type_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_sample_types.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('container_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_containers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('priority', sa.String(length=10), nullable=False, server_default='routine'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='registered'),
        sa.Column('collection_datetime', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_datetime', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'sample_number', name='uq_lab_samples_tenant_number'),
    )

    op.create_table(
        'lab_test_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sample_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_samples.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('test_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_definitions.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='ordered'),
        sa.Column('ordered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'lab_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('test_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_orders.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('result_value', sa.String(length=500), nullable=False),
        sa.Column('numeric_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('unit', sa.String(length=30), nullable=True),
        sa.Column('flag', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('entered_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('entered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('validated_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('validated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('authorized_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('authorized_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('test_order_id', name='uq_lab_results_test_order'),
    )

    op.create_table(
        'lab_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sample_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_samples.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('report_number', sa.String(length=40), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='released'),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('released_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('superseded_by_report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_reports.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'report_number', 'version', name='uq_lab_reports_tenant_number_version'),
    )

    for table in TABLES:
        _rls_and_audit(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
    op.drop_table('lab_reports')
    op.drop_table('lab_results')
    op.drop_table('lab_test_orders')
    op.drop_table('lab_samples')
    op.drop_table('lab_test_definitions')
    op.drop_table('lab_containers')
    op.drop_table('lab_sample_types')
