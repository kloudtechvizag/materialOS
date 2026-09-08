"""pricing, subscription, entitlement, usage and billing platform

Revision ID: f3c8b6a91d47
Revises: a1f4c9e02b7d
Create Date: 2026-09-08 13:00:00.000000

ADR-014. Platform catalog (no tenant_id, no RLS, same reasoning as
industry_profiles/permissions): plans, features, plan_features,
plan_limits. Tenant-scoped (RLS+audit): subscriptions,
subscription_addons, usage_records, billing_addresses,
subscription_invoices, subscription_invoice_items,
subscription_payments -- named distinctly from the pre-existing
invoices/invoice_items/payments-shaped tables (Slice 1's `invoices` and
`receipts`), which are a tenant's bills to *their own* customers, not
MaterialOS's bill to the tenant.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f3c8b6a91d47'
down_revision: Union[str, None] = 'a1f4c9e02b7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "subscriptions", "subscription_addons", "usage_records", "billing_addresses",
    "subscription_invoices", "subscription_invoice_items", "subscription_payments",
]
AUDITED_TABLES = RLS_TABLES


def upgrade() -> None:
    # ---- platform catalog (no tenant_id) ----
    op.create_table(
        'features',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_features_code'),
    )

    op.create_table(
        'plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('tier_order', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('is_default_signup_plan', sa.Boolean(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('monthly_price', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('yearly_price', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('trial_days', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', 'version', name='uq_plans_slug_version'),
    )

    op.create_table(
        'plan_features',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('feature_id', sa.UUID(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feature_id'], ['features.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'feature_id', name='uq_plan_features'),
    )
    op.create_index(op.f('ix_plan_features_plan_id'), 'plan_features', ['plan_id'], unique=False)
    op.create_index(op.f('ix_plan_features_feature_id'), 'plan_features', ['feature_id'], unique=False)

    op.create_table(
        'plan_limits',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('limit_key', sa.String(length=50), nullable=False),
        sa.Column('limit_value', sa.Integer(), nullable=True),
        sa.Column('is_hard_limit', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'limit_key', name='uq_plan_limits'),
    )
    op.create_index(op.f('ix_plan_limits_plan_id'), 'plan_limits', ['plan_id'], unique=False)

    op.create_table(
        'addon_offerings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('feature_id', sa.UUID(), nullable=True),
        sa.Column('limit_key', sa.String(length=50), nullable=True),
        sa.Column('limit_delta', sa.Integer(), nullable=True),
        sa.Column('monthly_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('yearly_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['feature_id'], ['features.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_addon_offerings_code'),
    )

    # ---- tenant-scoped ----
    op.create_table(
        'subscriptions',
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('billing_cycle', sa.String(length=10), nullable=False),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('grace_period_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_subscriptions_plan_id'), 'subscriptions', ['plan_id'], unique=False)
    op.create_index(op.f('ix_subscriptions_tenant_id'), 'subscriptions', ['tenant_id'], unique=False)

    op.create_table(
        'subscription_addons',
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('addon_offering_id', sa.UUID(), nullable=True),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('feature_id', sa.UUID(), nullable=True),
        sa.Column('limit_key', sa.String(length=50), nullable=True),
        sa.Column('limit_delta', sa.Integer(), nullable=True),
        sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('billing_cycle', sa.String(length=10), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['addon_offering_id'], ['addon_offerings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['feature_id'], ['features.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_subscription_addons_subscription_id'), 'subscription_addons', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_subscription_addons_tenant_id'), 'subscription_addons', ['tenant_id'], unique=False)

    op.create_table(
        'usage_records',
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('metric_key', sa.String(length=50), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'subscription_id', 'metric_key', 'period_start', name='uq_usage_records_period'),
    )
    op.create_index(op.f('ix_usage_records_subscription_id'), 'usage_records', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_usage_records_tenant_id'), 'usage_records', ['tenant_id'], unique=False)

    op.create_table(
        'billing_addresses',
        sa.Column('legal_name', sa.String(length=200), nullable=False),
        sa.Column('gstin', sa.String(length=15), nullable=True),
        sa.Column('pan', sa.String(length=10), nullable=True),
        sa.Column('address_line1', sa.String(length=200), nullable=False),
        sa.Column('address_line2', sa.String(length=200), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=False),
        sa.Column('pincode', sa.String(length=10), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_billing_addresses_tenant_id'), 'billing_addresses', ['tenant_id'], unique=False)

    op.create_table(
        'subscription_invoices',
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('billing_period_start', sa.Date(), nullable=False),
        sa.Column('billing_period_end', sa.Date(), nullable=False),
        sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('cgst_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('sgst_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('igst_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'invoice_number', name='uq_subscription_invoices_number'),
    )
    op.create_index(op.f('ix_subscription_invoices_subscription_id'), 'subscription_invoices', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_subscription_invoices_tenant_id'), 'subscription_invoices', ['tenant_id'], unique=False)

    op.create_table(
        'subscription_invoice_items',
        sa.Column('subscription_invoice_id', sa.UUID(), nullable=False),
        sa.Column('description', sa.String(length=300), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_invoice_id'], ['subscription_invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_subscription_invoice_items_subscription_invoice_id'), 'subscription_invoice_items', ['subscription_invoice_id'], unique=False)
    op.create_index(op.f('ix_subscription_invoice_items_tenant_id'), 'subscription_invoice_items', ['tenant_id'], unique=False)

    op.create_table(
        'subscription_payments',
        sa.Column('subscription_invoice_id', sa.UUID(), nullable=True),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('provider_order_id', sa.String(length=100), nullable=False),
        sa.Column('provider_payment_id', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('method', sa.String(length=20), nullable=True),
        sa.Column('failure_reason', sa.String(length=500), nullable=True),
        sa.Column('raw_event', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_invoice_id'], ['subscription_invoices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_subscription_payments_subscription_invoice_id'), 'subscription_payments', ['subscription_invoice_id'], unique=False)
    op.create_index(op.f('ix_subscription_payments_tenant_id'), 'subscription_payments', ['tenant_id'], unique=False)

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

    op.drop_table('subscription_payments')
    op.drop_table('subscription_invoice_items')
    op.drop_table('subscription_invoices')
    op.drop_table('billing_addresses')
    op.drop_table('usage_records')
    op.drop_table('subscription_addons')
    op.drop_table('subscriptions')
    op.drop_table('plan_limits')
    op.drop_table('addon_offerings')
    op.drop_table('plan_features')
    op.drop_table('plans')
    op.drop_table('features')
