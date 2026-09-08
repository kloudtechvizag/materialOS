import uuid
from datetime import date

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.models.numbering import FinancialYear
from app.models.tenant import Branch, Company, Tenant, Warehouse
from app.services.accounts import ensure_default_accounts
from app.services.industry import get_profile_by_slug


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

    # building_materials is seeded directly by its introducing migration
    # (needed to backfill pre-existing companies there), so it's present
    # even though nothing here triggers app startup's lifespan seeding.
    industry_profile = get_profile_by_slug(db, "building_materials")
    company = Company(
        tenant_id=tenant.id,
        name="Test Co",
        legal_name="Test Co Pvt Ltd",
        state="Andhra Pradesh",
        industry_profile_id=industry_profile.id if industry_profile else None,
    )
    db.add(company)
    db.flush()

    branch = Branch(tenant_id=tenant.id, company_id=company.id, name="Main", code="MAIN")
    db.add(branch)
    db.flush()

    warehouse = Warehouse(tenant_id=tenant.id, branch_id=branch.id, name="Main Godown", code="MAIN-WH")
    db.add(warehouse)
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

    ensure_default_accounts(db, tenant_id=tenant.id, company_id=company.id)

    return {
        "tenant": tenant,
        "company": company,
        "branch": branch,
        "warehouse": warehouse,
        "financial_year": fy,
    }
