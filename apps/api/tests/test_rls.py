"""B9: tenant isolation is enforced at the database, not the ORM.

Two tests:
1. Schema introspection -- every table with a tenant_id column must have
   RLS enabled. This is the CI guardrail that catches a forgotten policy
   on a brand-new table before it ships.
2. Functional -- a query with no app.current_tenant session variable set
   returns zero rows, even though matching rows exist.
"""

import uuid
from datetime import date

from sqlalchemy import create_engine, delete, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.models.tenant import Company, Tenant


def test_every_tenant_scoped_table_has_rls_enabled(engine):
    with engine.connect() as conn:
        tables_with_tenant_id = conn.execute(
            text(
                """
                SELECT DISTINCT table_name FROM information_schema.columns
                WHERE column_name = 'tenant_id' AND table_schema = 'public'
                """
            )
        ).scalars().all()

        assert tables_with_tenant_id, "expected at least one tenant-scoped table"

        rls_enabled = dict(
            conn.execute(
                text(
                    """
                    SELECT relname, relrowsecurity FROM pg_class
                    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
                    WHERE pg_namespace.nspname = 'public' AND relkind = 'r'
                    """
                )
            ).all()
        )

    missing = [t for t in tables_with_tenant_id if not rls_enabled.get(t, False)]
    assert not missing, f"tables with tenant_id but RLS not enabled: {missing}"


def test_query_without_tenant_context_returns_zero_rows(engine):
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    setup = Session()
    tenant = Tenant(name="RLS Test", slug=f"rls-test-{uuid.uuid4().hex[:8]}")
    setup.add(tenant)
    setup.flush()
    set_session_context(setup, tenant_id=str(tenant.id), user_id=None)
    company = Company(tenant_id=tenant.id, name="RLS Co", legal_name="RLS Co Pvt Ltd")
    setup.add(company)
    setup.commit()
    setup.close()

    try:
        no_context_session = Session()
        try:
            rows = no_context_session.query(Company).filter(Company.id == company.id).all()
            assert rows == [], "RLS did not block a query with no tenant context set"
        finally:
            no_context_session.close()
    finally:
        cleanup = Session()
        set_session_context(cleanup, tenant_id=str(tenant.id), user_id=None)
        cleanup.execute(delete(Company).where(Company.tenant_id == tenant.id))
        cleanup.commit()
        cleanup.execute(delete(Tenant).where(Tenant.id == tenant.id))
        cleanup.commit()
        cleanup.close()
