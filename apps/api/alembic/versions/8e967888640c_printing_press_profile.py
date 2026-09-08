"""printing press profile: print_jobs, print_job_artwork, print_machines

Revision ID: 8e967888640c
Revises: 4cb287087cf2
Create Date: 2026-09-08 02:00:00.000000

ADR-011. Three new tables -- everything else (media/consumables,
project-based printing, outsourcing vendors, billing) reuses existing
tables (Item/Category, Project/Site, Supplier, Invoice), see
models/printing.py's module docstring.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '8e967888640c'
down_revision: Union[str, None] = '4cb287087cf2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ["print_machines", "print_jobs", "print_job_artwork"]
AUDITED_TABLES = ["print_machines", "print_jobs", "print_job_artwork"]


def upgrade() -> None:
    op.create_table(
        'print_machines',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('machine_type', sa.String(length=100), nullable=False),
        sa.Column('capacity_per_hour', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('capacity_unit', sa.String(length=30), nullable=True),
        sa.Column('hourly_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_print_machines_company_id'), 'print_machines', ['company_id'], unique=False)
    op.create_index(op.f('ix_print_machines_tenant_id'), 'print_machines', ['tenant_id'], unique=False)

    op.create_table(
        'print_jobs',
        sa.Column('number', sa.String(length=40), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('item_id', sa.UUID(), nullable=True),
        sa.Column('job_type', sa.String(length=100), nullable=False),
        sa.Column('specification', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('machine_id', sa.UUID(), nullable=True),
        sa.Column('media_item_id', sa.UUID(), nullable=True),
        sa.Column('media_qty', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('warehouse_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('priority', sa.String(length=20), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('delivery_mode', sa.String(length=20), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_outsourced', sa.Boolean(), nullable=False),
        sa.Column('outsource_vendor_id', sa.UUID(), nullable=True),
        sa.Column('outsource_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('material_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('printing_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('finishing_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('labor_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('wastage_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('finishing_ops', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('quoted_price', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('gst_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('qc_status', sa.String(length=20), nullable=True),
        sa.Column('qc_notes', sa.String(length=500), nullable=True),
        sa.Column('rework_of_job_id', sa.UUID(), nullable=True),
        sa.Column('invoice_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.String(length=1000), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['machine_id'], ['print_machines.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['media_item_id'], ['items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['outsource_vendor_id'], ['suppliers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['rework_of_job_id'], ['print_jobs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    for col in ['company_id', 'branch_id', 'customer_id', 'project_id', 'item_id', 'machine_id',
                'media_item_id', 'warehouse_id', 'outsource_vendor_id', 'rework_of_job_id',
                'invoice_id', 'tenant_id']:
        op.create_index(op.f(f'ix_print_jobs_{col}'), 'print_jobs', [col], unique=False)

    op.create_table(
        'print_job_artwork',
        sa.Column('print_job_id', sa.UUID(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('uploaded_by_user_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('comments', sa.String(length=1000), nullable=True),
        sa.Column('approved_by_user_id', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['print_job_id'], ['print_jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_print_job_artwork_print_job_id'), 'print_job_artwork', ['print_job_id'], unique=False)
    op.create_index(op.f('ix_print_job_artwork_tenant_id'), 'print_job_artwork', ['tenant_id'], unique=False)

    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            """
        )

    for table in AUDITED_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER audit_trg
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
            """
        )


def downgrade() -> None:
    for table in AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
    for table in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_table('print_job_artwork')
    op.drop_table('print_jobs')
    op.drop_table('print_machines')
