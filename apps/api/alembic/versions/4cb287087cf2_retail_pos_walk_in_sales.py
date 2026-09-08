"""retail pos: walk_in_sales

Revision ID: 4cb287087cf2
Revises: 892b9921b956
Create Date: 2026-09-08 01:00:00.000000

WalkInSale (see models/pos.py, services/pos.py) is a thin header around
a real Invoice -- no new line-item, tax, or journal tables. Schema +
RLS + audit in one migration since it's a single table, unlike the
per-slice migrations this repo otherwise splits in two.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '4cb287087cf2'
down_revision: Union[str, None] = '892b9921b956'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ["walk_in_sales"]
AUDITED_TABLES = ["walk_in_sales"]


def upgrade() -> None:
    op.create_table(
        'walk_in_sales',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('cash_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('upi_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('card_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('tendered_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('change_due', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_id', name='uq_walk_in_sales_invoice_id'),
    )
    op.create_index(op.f('ix_walk_in_sales_company_id'), 'walk_in_sales', ['company_id'], unique=False)
    op.create_index(op.f('ix_walk_in_sales_branch_id'), 'walk_in_sales', ['branch_id'], unique=False)
    op.create_index(op.f('ix_walk_in_sales_warehouse_id'), 'walk_in_sales', ['warehouse_id'], unique=False)
    op.create_index(op.f('ix_walk_in_sales_invoice_id'), 'walk_in_sales', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_walk_in_sales_customer_id'), 'walk_in_sales', ['customer_id'], unique=False)
    op.create_index(op.f('ix_walk_in_sales_tenant_id'), 'walk_in_sales', ['tenant_id'], unique=False)

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

    op.drop_table('walk_in_sales')
