"""fee payment gateway: FeePayment table

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-09-22 14:00:00.000000

ADR-042: field-for-field mirror of subscription_payments
(ADR-014) -- see models/fees.py's own docstring.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fee_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('fee_invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fee_invoices.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('provider_order_id', sa.String(length=100), nullable=False),
        sa.Column('provider_payment_id', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('method', sa.String(length=20), nullable=True),
        sa.Column('failure_reason', sa.String(length=500), nullable=True),
        sa.Column('raw_event', postgresql.JSONB(), nullable=True),
        sa.Column('receipt_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('receipts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute("ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE fee_payments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON fee_payments
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON fee_payments
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_trg ON fee_payments")
    op.drop_table('fee_payments')
