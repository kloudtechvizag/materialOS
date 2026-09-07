"""B7: 200 concurrent invoice-number requests must produce 200
consecutive numbers -- no gaps, no duplicates. Uses real threads and
real DB connections (not asyncio) so the SELECT ... FOR UPDATE lock is
genuinely contended.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.models.importing import ImportBatch, ImportBatchRow
from app.models.numbering import DocNumberCounter, FinancialYear
from app.models.tenant import Branch, Company, Tenant
from app.services.numbering import next_document_number

N_CONCURRENT = 200


def _make_scope():
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()

    tenant = Tenant(name="Numbering Test", slug=f"numbering-test-{uuid.uuid4().hex[:8]}")
    session.add(tenant)
    session.flush()
    set_session_context(session, tenant_id=str(tenant.id), user_id=None)

    company = Company(tenant_id=tenant.id, name="Co", legal_name="Co Pvt Ltd")
    session.add(company)
    session.flush()

    branch = Branch(tenant_id=tenant.id, company_id=company.id, name="Main", code="MAIN")
    session.add(branch)
    session.flush()

    fy = FinancialYear(
        tenant_id=tenant.id, company_id=company.id, code="2026-27",
        start_date=date(2026, 4, 1), end_date=date(2027, 3, 31),
    )
    session.add(fy)
    session.commit()

    ids = {"tenant_id": tenant.id, "company_id": company.id, "branch_id": branch.id, "financial_year_id": fy.id}
    session.close()
    engine.dispose()
    return ids


def _cleanup(ids: dict) -> None:
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    set_session_context(session, tenant_id=str(ids["tenant_id"]), user_id=None)
    session.execute(delete(DocNumberCounter).where(DocNumberCounter.tenant_id == ids["tenant_id"]))
    session.execute(delete(FinancialYear).where(FinancialYear.tenant_id == ids["tenant_id"]))
    session.execute(delete(Branch).where(Branch.tenant_id == ids["tenant_id"]))
    session.execute(delete(Company).where(Company.tenant_id == ids["tenant_id"]))
    session.commit()
    session.execute(delete(Tenant).where(Tenant.id == ids["tenant_id"]))
    session.commit()
    session.close()
    engine.dispose()


def _request_one_number(ids: dict) -> str:
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    try:
        set_session_context(session, tenant_id=str(ids["tenant_id"]), user_id=None)
        number = next_document_number(
            session,
            company_id=ids["company_id"],
            branch_id=ids["branch_id"],
            financial_year_id=ids["financial_year_id"],
            doc_type="INV",
            default_prefix="INV",
        )
        session.commit()
        return number
    finally:
        session.close()
        engine.dispose()


def test_concurrent_numbering_has_no_gaps_or_duplicates():
    ids = _make_scope()
    try:
        with ThreadPoolExecutor(max_workers=25) as pool:
            numbers = list(pool.map(lambda _: _request_one_number(ids), range(N_CONCURRENT)))

        assert len(numbers) == N_CONCURRENT
        assert len(set(numbers)) == N_CONCURRENT, "duplicate document numbers were issued"

        suffixes = sorted(int(n.rsplit("-", 1)[-1]) for n in numbers)
        assert suffixes == list(range(1, N_CONCURRENT + 1)), "document numbers have a gap"
    finally:
        _cleanup(ids)
