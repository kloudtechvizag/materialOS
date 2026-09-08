"""receipt template engine

Revision ID: d2a6f813c95b
Revises: c9d4f27a5e83
Create Date: 2026-09-08 18:00:00.000000

ADR-016. Company.phone/email (a receipt's header needs a real business
phone/email and neither existed anywhere in the schema before -- only
a customer/supplier's own contact details did), the receipt_settings
table (RLS+audit, one row per company), and -- in the same migration
this time, not a follow-up bug report -- the "receipts" RESOURCES
backfill onto every existing tenant's owner role (the same gap fixed
four separate times already this session: a1f4c9e02b7d, c7e1a49f0b6d,
b4a97d02e6c1, f1c8e34b7a02).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd2a6f813c95b'
down_revision: Union[str, None] = 'c9d4f27a5e83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCE = "receipts"
ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage"]


def upgrade() -> None:
    op.add_column('companies', sa.Column('phone', sa.String(length=20), nullable=True))
    op.add_column('companies', sa.Column('email', sa.String(length=255), nullable=True))

    op.create_table(
        'receipt_settings',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('show_logo', sa.Boolean(), nullable=False),
        sa.Column('show_customer_details', sa.Boolean(), nullable=False),
        sa.Column('show_gst_breakdown', sa.Boolean(), nullable=False),
        sa.Column('show_sku', sa.Boolean(), nullable=False),
        sa.Column('show_cashier', sa.Boolean(), nullable=False),
        sa.Column('show_qr_code', sa.Boolean(), nullable=False),
        sa.Column('footer_message', sa.String(length=500), nullable=True),
        sa.Column('terms_and_conditions', sa.String(length=1000), nullable=True),
        sa.Column('return_policy', sa.String(length=1000), nullable=True),
        sa.Column('upi_id', sa.String(length=100), nullable=True),
        sa.Column('social_contact_info', sa.String(length=300), nullable=True),
        sa.Column('default_paper_width_mm', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_receipt_settings_company'),
    )
    op.create_index(op.f('ix_receipt_settings_company_id'), 'receipt_settings', ['company_id'], unique=False)
    op.create_index(op.f('ix_receipt_settings_tenant_id'), 'receipt_settings', ['tenant_id'], unique=False)

    op.execute("ALTER TABLE receipt_settings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE receipt_settings FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON receipt_settings
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON receipt_settings
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )

    for action in ACTIONS:
        op.execute(
            f"""
            INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
            SELECT gen_random_uuid(), '{RESOURCE}.{action}', '{RESOURCE}', '{action}', now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = '{RESOURCE}.{action}')
            """
        )
    op.execute(
        f"""
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND p.resource = '{RESOURCE}'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_trg ON receipt_settings")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON receipt_settings")
    op.execute("ALTER TABLE receipt_settings NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE receipt_settings DISABLE ROW LEVEL SECURITY")
    op.drop_table('receipt_settings')
    op.drop_column('companies', 'email')
    op.drop_column('companies', 'phone')
