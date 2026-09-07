"""B4: 50 concurrent reservation requests against 100 units of stock;
total reserved must be exactly <= 100, and (since each request asks for
enough that only 100 can ever be granted) confirms real serialisation
rather than a lost-update race.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.errors import AppError
from app.models.inventory import StockBalance, StockLedger, StockReservation
from app.models.masters import Item
from app.models.tenant import Branch, Company, Tenant, Warehouse
from app.services.inventory import apply_ledger_movement, reserve_stock

N_CONCURRENT = 50
UNITS_PER_REQUEST = 3  # 50 * 3 = 150 requested against 100 available -- some must fail
TOTAL_STOCK = 100


def _make_scope():
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()

    tenant = Tenant(name="Reservation Test", slug=f"reservation-test-{uuid.uuid4().hex[:8]}")
    session.add(tenant)
    session.flush()
    set_session_context(session, tenant_id=str(tenant.id), user_id=None)

    company = Company(tenant_id=tenant.id, name="Co", legal_name="Co Pvt Ltd")
    session.add(company)
    session.flush()
    branch = Branch(tenant_id=tenant.id, company_id=company.id, name="Main", code="MAIN")
    session.add(branch)
    session.flush()
    warehouse = Warehouse(tenant_id=tenant.id, branch_id=branch.id, name="Main", code="MAIN-WH")
    session.add(warehouse)
    session.flush()
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="TEST-ITEM", name="Test Item",
        base_uom="PCS", gst_rate=0,
    )
    session.add(item)
    session.flush()

    apply_ledger_movement(
        session, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id,
        qty=TOTAL_STOCK, rate=0, movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )
    session.commit()

    ids = {"tenant_id": tenant.id, "warehouse_id": warehouse.id, "item_id": item.id}
    session.close()
    engine.dispose()
    return ids


def _cleanup(ids: dict) -> None:
    # set_session_context uses SET LOCAL, which lives only for the current
    # transaction -- a commit ends it and RLS then silently blocks every
    # further delete in a new transaction. So: one transaction, one commit.
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    set_session_context(session, tenant_id=str(ids["tenant_id"]), user_id=None)
    session.execute(delete(StockReservation).where(StockReservation.tenant_id == ids["tenant_id"]))
    session.execute(delete(StockLedger).where(StockLedger.tenant_id == ids["tenant_id"]))
    session.execute(delete(StockBalance).where(StockBalance.tenant_id == ids["tenant_id"]))
    session.execute(delete(Item).where(Item.tenant_id == ids["tenant_id"]))
    session.execute(delete(Warehouse).where(Warehouse.tenant_id == ids["tenant_id"]))
    session.execute(delete(Branch).where(Branch.tenant_id == ids["tenant_id"]))
    session.execute(delete(Company).where(Company.tenant_id == ids["tenant_id"]))
    session.commit()
    session.execute(delete(Tenant).where(Tenant.id == ids["tenant_id"]))
    session.commit()
    session.close()
    engine.dispose()


def _attempt_reservation(ids: dict) -> str:
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    try:
        set_session_context(session, tenant_id=str(ids["tenant_id"]), user_id=None)
        try:
            reserve_stock(
                session,
                tenant_id=ids["tenant_id"], warehouse_id=ids["warehouse_id"], item_id=ids["item_id"],
                qty=UNITS_PER_REQUEST, reference_type="test_order", reference_id=uuid.uuid4(),
            )
            session.commit()
            return "granted"
        except AppError:
            session.rollback()
            return "rejected"
    finally:
        session.close()
        engine.dispose()


def test_concurrent_reservations_never_oversell():
    ids = _make_scope()
    try:
        with ThreadPoolExecutor(max_workers=25) as pool:
            results = list(pool.map(lambda _: _attempt_reservation(ids), range(N_CONCURRENT)))

        granted = results.count("granted")
        rejected = results.count("rejected")
        assert granted + rejected == N_CONCURRENT
        assert granted * UNITS_PER_REQUEST <= TOTAL_STOCK
        # With 50 requests of 3 units against 100 units, at most 33 can be granted.
        assert granted <= TOTAL_STOCK // UNITS_PER_REQUEST
        assert rejected > 0, "expected the lock to actually contend and reject some requests"
    finally:
        _cleanup(ids)
