"""serial_units (gated by existing items.* permissions -- no new
resource) and rma_requests (RLS+audit, plus the "rma" permission
catalog backfill onto every existing tenant's owner role, combined in
this one migration -- same recurring gap, not a repeat).

Revision ID: ae09f11c2acb
Revises: 720951c47834
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'ae09f11c2acb'
down_revision: Union[str, None] = '720951c47834'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCE = "rma"
ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage", "calculate", "lock", "pay"]


def upgrade() -> None:
    op.create_table(
        'serial_units',
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('serial_number', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=True),
        sa.Column('purchase_bill_item_id', sa.UUID(), nullable=True),
        sa.Column('invoice_item_id', sa.UUID(), nullable=True),
        sa.Column('warranty_expiry', sa.Date(), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['purchase_bill_item_id'], ['purchase_bill_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['invoice_item_id'], ['invoice_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_serial_units_item_id'), 'serial_units', ['item_id'], unique=False)
    op.create_index(op.f('ix_serial_units_serial_number'), 'serial_units', ['serial_number'], unique=False)
    op.create_index(op.f('ix_serial_units_warehouse_id'), 'serial_units', ['warehouse_id'], unique=False)
    op.create_index(op.f('ix_serial_units_purchase_bill_item_id'), 'serial_units', ['purchase_bill_item_id'], unique=False)
    op.create_index(op.f('ix_serial_units_invoice_item_id'), 'serial_units', ['invoice_item_id'], unique=False)
    op.create_index(op.f('ix_serial_units_tenant_id'), 'serial_units', ['tenant_id'], unique=False)
    # A given tenant can't register the same serial number for the same
    # item twice -- doesn't stop two DIFFERENT items sharing a serial by
    # coincidence, which is a real (if rare) possibility across brands.
    op.create_unique_constraint('uq_serial_units_tenant_item_serial', 'serial_units', ['tenant_id', 'item_id', 'serial_number'])

    op.create_table(
        'rma_requests',
        sa.Column('number', sa.String(length=40), nullable=False),
        sa.Column('serial_unit_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('resolution', sa.String(length=20), nullable=True),
        sa.Column('resolution_notes', sa.String(length=500), nullable=True),
        sa.Column('requested_date', sa.Date(), nullable=False),
        sa.Column('resolved_date', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['serial_unit_id'], ['serial_units.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rma_requests_number'), 'rma_requests', ['number'], unique=False)
    op.create_index(op.f('ix_rma_requests_serial_unit_id'), 'rma_requests', ['serial_unit_id'], unique=False)
    op.create_index(op.f('ix_rma_requests_customer_id'), 'rma_requests', ['customer_id'], unique=False)
    op.create_index(op.f('ix_rma_requests_tenant_id'), 'rma_requests', ['tenant_id'], unique=False)

    for table in ('serial_units', 'rma_requests'):
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
    for table in ('rma_requests', 'serial_units'):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_table('rma_requests')
    op.drop_table('serial_units')
