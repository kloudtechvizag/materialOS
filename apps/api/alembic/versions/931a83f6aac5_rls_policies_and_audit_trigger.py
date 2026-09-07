"""rls policies and audit trigger

Revision ID: 931a83f6aac5
Revises: 37abdb5a97df
Create Date: 2026-09-07 07:35:01.495570

Implements invariants B9 (tenant isolation at the database) and B12
(audit written by the database, not by developers).
"""
from typing import Sequence, Union

from alembic import op

revision: str = '931a83f6aac5'
down_revision: Union[str, None] = '37abdb5a97df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every table carrying a tenant_id column, per B9. Keep this in sync with
# app/models -- CI's schema-introspection test (see tests/test_rls.py)
# fails the build if a tenant_id column exists without a matching policy.
RLS_TABLES = [
    "companies",
    "branches",
    "warehouses",
    "users",
    "roles",
    "role_permissions",
    "user_roles",
    "financial_years",
    "doc_number_counters",
    "customers",
    "suppliers",
    "items",
    "stock_ledger",
    "stock_balance",
    "import_batches",
    "import_batch_rows",
    "idempotency_keys",
    "audit_log",
]

# Masters/config tables where a human-driven change is worth a diff in
# audit_log (B12). Pure append-only ledgers (stock_ledger) and transient
# staging tables (import_batch_rows, idempotency_keys) are excluded --
# their own immutability, or their short-lived nature, already gives the
# guarantee an audit trail exists for.
AUDITED_TABLES = [
    "companies",
    "branches",
    "warehouses",
    "users",
    "roles",
    "role_permissions",
    "user_roles",
    "financial_years",
    "doc_number_counters",
    "customers",
    "suppliers",
    "items",
    "import_batches",
]

AUDIT_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
DECLARE
    v_tenant uuid;
    v_user uuid;
BEGIN
    v_tenant := NULLIF(current_setting('app.current_tenant', true), '')::uuid;
    v_user := NULLIF(current_setting('app.current_user', true), '')::uuid;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log(id, tenant_id, table_name, row_id, action, old_data, new_data, changed_by_user_id, occurred_at)
        VALUES (gen_random_uuid(), v_tenant, TG_TABLE_NAME, NEW.id, TG_OP, NULL, row_to_json(NEW)::jsonb, v_user, now());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log(id, tenant_id, table_name, row_id, action, old_data, new_data, changed_by_user_id, occurred_at)
        VALUES (gen_random_uuid(), v_tenant, TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_user, now());
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log(id, tenant_id, table_name, row_id, action, old_data, new_data, changed_by_user_id, occurred_at)
        VALUES (gen_random_uuid(), v_tenant, TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb, NULL, v_user, now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # FORCE so the table owner (the app's own DB role) is subject to
        # the policy too -- otherwise RLS is a no-op for the connection
        # the API actually uses.
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            """
        )

    op.execute(AUDIT_TRIGGER_FN)

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
    op.execute("DROP FUNCTION IF EXISTS audit_trigger_fn()")

    for table in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
