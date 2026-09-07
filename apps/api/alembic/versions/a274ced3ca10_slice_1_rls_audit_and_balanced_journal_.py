"""slice 1 rls audit and balanced journal trigger

Revision ID: a274ced3ca10
Revises: 3032f9f907f6
Create Date: 2026-09-07 09:09:15.568813

Extends B9 (RLS) and B12 (audit) to every Slice 1 table, and adds the
DB-level enforcement of B5 (every journal balances) that Slice 0 had no
journal table to attach yet.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a274ced3ca10'
down_revision: Union[str, None] = '3032f9f907f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "categories",
    "unit_conversions",
    "batches",
    "customer_item_prices",
    "rate_contracts",
    "projects",
    "sites",
    "stock_reservations",
    "accounts",
    "journal_entries",
    "journal_lines",
    "quotations",
    "quotation_items",
    "sales_orders",
    "sales_order_items",
    "delivery_challans",
    "delivery_challan_items",
    "invoices",
    "invoice_items",
    "receipts",
    "payment_allocations",
]

# Transactional line-item tables (quotation_items, sales_order_items,
# invoice_items, journal_lines, delivery_challan_items, payment_allocations)
# are excluded, same reasoning as Slice 0's stock_ledger: their parent
# document row is what a human edits, and the parent's own audit_trg
# already captures document-level state changes. stock_reservations is
# a status machine driven by services.inventory, not a human-editable
# master -- excluded for the same reason stock_ledger was.
AUDITED_TABLES = [
    "categories",
    "customer_item_prices",
    "rate_contracts",
    "projects",
    "sites",
    "accounts",
    "quotations",
    "sales_orders",
    "delivery_challans",
    "invoices",
    "receipts",
]

BALANCED_JOURNAL_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION assert_journal_balanced_fn() RETURNS trigger AS $$
DECLARE
    v_journal_entry_id uuid;
    v_total_debit numeric(18,4);
    v_total_credit numeric(18,4);
BEGIN
    v_journal_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
      INTO v_total_debit, v_total_credit
      FROM journal_lines
     WHERE journal_entry_id = v_journal_entry_id;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Journal entry % is unbalanced: debit % <> credit % (B5)',
            v_journal_entry_id, v_total_debit, v_total_credit
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""


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

    op.execute(BALANCED_JOURNAL_TRIGGER_FN)
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER assert_journal_balanced_trg
        AFTER INSERT OR UPDATE OR DELETE ON journal_lines
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced_fn()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS assert_journal_balanced_trg ON journal_lines")
    op.execute("DROP FUNCTION IF EXISTS assert_journal_balanced_fn()")

    for table in AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")

    for table in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
