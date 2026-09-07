"""slice 2 rls and audit

Revision ID: 3060b4b1c53e
Revises: ec190f2c16bd
Create Date: 2026-09-07 10:30:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = '3060b4b1c53e'
down_revision: Union[str, None] = 'ec190f2c16bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "vehicles",
    "drivers",
    "trips",
    "proof_of_deliveries",
    "stock_transfers",
    "stock_transfer_items",
    "stock_counts",
    "stock_count_items",
    "sales_returns",
    "sales_return_items",
]

# Line-item tables (stock_transfer_items, stock_count_items,
# sales_return_items) skip the trigger for the same reason Slice 0/1's
# line-item tables do: the parent document's own audit_trg already
# captures the human-editable state.
AUDITED_TABLES = [
    "vehicles",
    "drivers",
    "trips",
    "proof_of_deliveries",
    "stock_transfers",
    "stock_counts",
    "sales_returns",
]


def upgrade() -> None:
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
