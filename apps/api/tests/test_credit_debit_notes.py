"""Debit notes (purchase_returns) -- the purchase-side mirror of the
already-tested warehouse_ops.SalesReturn (see
test_dispatch_and_warehouse_ops.py::test_sales_return_reverses_stock_and_outstanding).
Also covers the one genuinely missing sales-return piece:
GET /sales-returns/{id}, which didn't exist anywhere before (only
list+create did, in warehouse_ops.py).
"""
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.models.masters import Item, Supplier
from app.models.sales import InvoiceItem
from app.services.inventory import apply_ledger_movement, assert_no_drift
from app.services.procurement import (
    approve_purchase_order,
    create_purchase_bill,
    create_purchase_order,
    receive_goods,
)
from app.services.purchase_return import create_purchase_return
from app.services.sales_return import create_sales_return

client = TestClient(app)


def _make_supplier_and_purchase_bill(db, tenant_ctx, *, qty: Decimal, rate: Decimal):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    supplier = Supplier(tenant_id=tenant.id, company_id=company.id, name="Debit Note Test Supplier")
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"DN-ITEM-{uuid.uuid4().hex[:6]}", name="Debit Note Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=rate, standard_cost=rate,
    )
    db.add_all([supplier, item])
    db.flush()

    order = create_purchase_order(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        supplier_id=supplier.id, financial_year_id=fy.id,
        lines=[{"item_id": item.id, "qty": qty, "rate": rate, "uom": "PCS"}],
    )
    approve_purchase_order(db, purchase_order_id=order.id)
    receipt = receive_goods(
        db, tenant_id=tenant.id, purchase_order_id=order.id, financial_year_id=fy.id, user_id=user_id,
        lines=[{"purchase_order_item_id": order.items[0].id, "qty_received": qty, "qc_status": "passed"}],
    )
    bill = create_purchase_bill(db, tenant_id=tenant.id, financial_year_id=fy.id, goods_receipt_id=receipt.id)
    return supplier, item, bill, user_id


def test_purchase_return_reverses_stock_and_ap(db, tenant_ctx):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    supplier, item, bill, user_id = _make_supplier_and_purchase_bill(db, tenant_ctx, qty=Decimal("10"), rate=Decimal("200"))

    from app.models.inventory import StockBalance
    balance_before = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item.id
    ).one().qty_on_hand
    assert balance_before == Decimal("10")

    purchase_return = create_purchase_return(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        purchase_bill_id=bill.id, warehouse_id=warehouse.id, reason="Wrong grade supplied",
        lines=[{"purchase_bill_item_id": bill.items[0].id, "qty": Decimal("3")}], user_id=user_id,
    )

    assert purchase_return.number.startswith("PRET")
    assert purchase_return.total == Decimal("708.00")  # 3 * 200 * 1.18

    assert_no_drift(db, tenant_id=tenant.id)

    balance_after = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item.id
    ).one().qty_on_hand
    assert balance_after == Decimal("7")  # 10 received - 3 returned


def test_purchase_return_partial_line_quantity_is_proportional(db, tenant_ctx):
    """Returning half a line's qty must bill exactly half that line's
    tax, mirroring how the sales-return side already proves this."""
    supplier, item, bill, user_id = _make_supplier_and_purchase_bill(db, tenant_ctx, qty=Decimal("4"), rate=Decimal("1000"))
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )

    purchase_return = create_purchase_return(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        purchase_bill_id=bill.id, warehouse_id=warehouse.id, reason=None,
        lines=[{"purchase_bill_item_id": bill.items[0].id, "qty": Decimal("2")}], user_id=user_id,
    )
    # 2 of 4 units returned = half the bill's line: 2 * 1000 * 1.18 = 2360
    assert purchase_return.total == Decimal("2360.00")


def _signed_up_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_purchase_and_sales_returns_http_endpoints_are_tenant_isolated():
    slug_a = f"cdn-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"cdn-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    for path in ("/api/v1/purchase-returns", "/api/v1/sales-returns"):
        resp_a = client.get(path, headers={"Authorization": f"Bearer {token_a}"})
        resp_b = client.get(path, headers={"Authorization": f"Bearer {token_b}"})
        assert resp_a.status_code == 200 and resp_b.status_code == 200
        assert resp_a.json() == [] and resp_b.json() == []

    unknown_return = client.get(f"/api/v1/sales-returns/{uuid.uuid4()}", headers={"Authorization": f"Bearer {token_a}"})
    assert unknown_return.status_code == 404
    unknown_debit_note = client.get(f"/api/v1/purchase-returns/{uuid.uuid4()}", headers={"Authorization": f"Bearer {token_a}"})
    assert unknown_debit_note.status_code == 404
