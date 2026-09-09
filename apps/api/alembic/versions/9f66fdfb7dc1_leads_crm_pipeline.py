"""leads (CRM pipeline): table, RLS+audit, and the "leads" permission
catalog backfill onto every existing tenant's owner role, combined in
this one migration -- the same gap fixed six times already this
session (a1f4c9e02b7d, c7e1a49f0b6d, b4a97d02e6c1, f1c8e34b7a02,
d2a6f813c95b, dc319c49d45d's non-repeat).

Revision ID: 9f66fdfb7dc1
Revises: dc319c49d45d
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '9f66fdfb7dc1'
down_revision: Union[str, None] = 'dc319c49d45d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCE = "leads"
ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage", "calculate", "lock", "pay"]


def upgrade() -> None:
    op.create_table(
        'leads',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('company_name', sa.String(length=200), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('estimated_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('notes', sa.String(length=2000), nullable=True),
        sa.Column('lost_reason', sa.String(length=500), nullable=True),
        sa.Column('assigned_to_user_id', sa.UUID(), nullable=True),
        sa.Column('converted_customer_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['converted_customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leads_company_id'), 'leads', ['company_id'], unique=False)
    op.create_index(op.f('ix_leads_branch_id'), 'leads', ['branch_id'], unique=False)
    op.create_index(op.f('ix_leads_assigned_to_user_id'), 'leads', ['assigned_to_user_id'], unique=False)
    op.create_index(op.f('ix_leads_converted_customer_id'), 'leads', ['converted_customer_id'], unique=False)
    op.create_index(op.f('ix_leads_tenant_id'), 'leads', ['tenant_id'], unique=False)

    op.execute("ALTER TABLE leads ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE leads FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON leads
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON leads
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
    op.execute("DROP TRIGGER IF EXISTS audit_trg ON leads")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON leads")
    op.execute("ALTER TABLE leads NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE leads DISABLE ROW LEVEL SECURITY")
    op.drop_table('leads')
