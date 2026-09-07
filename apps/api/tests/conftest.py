import uuid
from datetime import date

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.models.numbering import FinancialYear
from app.models.tenant import Branch, Company, Tenant


@pytest.fixture(scope="session")
def engine():
    return create_engine(settings.database_url)


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def tenant_ctx(db):
    """Creates a fresh tenant + company + branch + financial year and
    sets the RLS session context to it, all inside the test's own
    transaction (rolled back by the `db` fixture on teardown).
    """
    tenant = Tenant(name="Test Tenant", slug=f"test-{uuid.uuid4().hex[:8]}")
    db.add(tenant)
    db.flush()

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    company = Company(tenant_id=tenant.id, name="Test Co", legal_name="Test Co Pvt Ltd")
    db.add(company)
    db.flush()

    branch = Branch(tenant_id=tenant.id, company_id=company.id, name="Main", code="MAIN")
    db.add(branch)
    db.flush()

    fy = FinancialYear(
        tenant_id=tenant.id,
        company_id=company.id,
        code="2026-27",
        start_date=date(2026, 4, 1),
        end_date=date(2027, 3, 31),
    )
    db.add(fy)
    db.flush()

    return {"tenant": tenant, "company": company, "branch": branch, "financial_year": fy}
