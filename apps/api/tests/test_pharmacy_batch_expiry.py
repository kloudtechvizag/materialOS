"""Slice F (Pharmacy profile, ADR-010): Batch.expiry_date and the
near-expiry query/endpoint. Batch is not yet a dimension of
stock_ledger/stock_balance -- nothing assigns stock movements to a
specific batch today -- so this is reporting, not FEFO-enforced picking
(see services/inventory.py::near_expiry_batches's docstring).
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.models.catalog import Batch
from app.models.masters import Item
from app.services.inventory import near_expiry_batches


def _item(db, tenant, company, *, sku="PHM-PARA"):
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=sku, name=sku,
        gst_rate=Decimal("12"), base_uom="STRIP", standard_price=Decimal("20"), standard_cost=Decimal("10"),
    )
    db.add(item)
    db.flush()
    return item


def test_near_expiry_batches_orders_soonest_first_and_excludes_far_future(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    warehouse = tenant_ctx["warehouse"]
    item = _item(db, tenant, company)

    today = date.today()
    soon = Batch(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse.id,
        batch_code="B-SOON", expiry_date=today + timedelta(days=10), cost=Decimal("10"),
    )
    later = Batch(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse.id,
        batch_code="B-LATER", expiry_date=today + timedelta(days=45), cost=Decimal("10"),
    )
    far_future = Batch(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse.id,
        batch_code="B-FAR", expiry_date=today + timedelta(days=400), cost=Decimal("10"),
    )
    no_expiry = Batch(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse.id,
        batch_code="B-NONE", expiry_date=None, cost=Decimal("10"),
    )
    db.add_all([soon, later, far_future, no_expiry])
    db.flush()

    result = near_expiry_batches(db, tenant_id=tenant.id, days=60)

    assert [b.batch_code for b in result] == ["B-SOON", "B-LATER"]
