"""purchase_returns / purchase_return_items -- the purchase-side mirror
of sales_returns (warehouse_ops), gated by the existing suppliers.*
permissions, not a new resource -- no permission backfill needed here.

Revision ID: 720951c47834
Revises: 9f66fdfb7dc1
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '720951c47834'
down_revision: Union[str, None] = '9f66fdfb7dc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'purchase_returns',
        sa.Column('number', sa.String(length=40), nullable=False),
        sa.Column('purchase_bill_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('total', sa.Numeric(18, 4), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['purchase_bill_id'], ['purchase_bills.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_purchase_returns_number'), 'purchase_returns', ['number'], unique=False)
    op.create_index(op.f('ix_purchase_returns_purchase_bill_id'), 'purchase_returns', ['purchase_bill_id'], unique=False)
    op.create_index(op.f('ix_purchase_returns_warehouse_id'), 'purchase_returns', ['warehouse_id'], unique=False)
    op.create_index(op.f('ix_purchase_returns_tenant_id'), 'purchase_returns', ['tenant_id'], unique=False)

    op.create_table(
        'purchase_return_items',
        sa.Column('purchase_return_id', sa.UUID(), nullable=False),
        sa.Column('purchase_bill_item_id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('qty', sa.Numeric(18, 4), nullable=False),
        sa.Column('rate', sa.Numeric(18, 4), nullable=False),
        sa.Column('line_total', sa.Numeric(18, 4), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['purchase_return_id'], ['purchase_returns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['purchase_bill_item_id'], ['purchase_bill_items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_purchase_return_items_purchase_return_id'), 'purchase_return_items', ['purchase_return_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_purchase_bill_item_id'), 'purchase_return_items', ['purchase_bill_item_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_item_id'), 'purchase_return_items', ['item_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_tenant_id'), 'purchase_return_items', ['tenant_id'], unique=False)

    for table in ('purchase_returns', 'purchase_return_items'):
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


def downgrade() -> None:
    for table in ('purchase_return_items', 'purchase_returns'):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_table('purchase_return_items')
    op.drop_table('purchase_returns')
