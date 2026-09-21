"""fees domain

Revision ID: 2b5204ab912e
Revises: f0a1b2c3d4e5
Create Date: 2026-09-27 06:05:00.000000

FeeHead (a billable fee type, backed by a real Item), FeeStructureItem
(per-class fee schedule), FeeInvoice/FeeInvoiceLine (bridge a real
core Invoice back to the Student it was raised for). Standard
per-tenant RLS + audit_trg on all four tables.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '2b5204ab912e'
down_revision: Union[str, None] = 'f0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['fee_heads', 'fee_structure_items', 'fee_invoices', 'fee_invoice_lines']


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
        'fee_heads',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('items.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_fee_heads_company_code'),
    )

    op.create_table(
        'fee_structure_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('school_class_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('school_classes.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('fee_head_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fee_heads.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'academic_year_id', 'school_class_id', 'fee_head_id', name='uq_fee_structure_items'),
    )

    op.create_table(
        'fee_invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'invoice_id', name='uq_fee_invoices_invoice'),
    )

    op.create_table(
        'fee_invoice_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('fee_invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fee_invoices.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('fee_structure_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fee_structure_items.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'student_id', 'fee_structure_item_id', name='uq_fee_invoice_lines_student_item'),
    )

    for table in TABLES:
        _rls(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.drop_table(table)
