"""Suppliers list page (list, /summary, PATCH) -- the bulk aggregate
functions must agree exactly with the already-trusted per-supplier
compute_payable()/open-PO-count used by GET /suppliers/{id}/360, not
approximate it, since the list page and the 360 page render the same
number for the same supplier.
"""
import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.masters import Item, Supplier
from app.services.procurement import (
    approve_purchase_order,
    create_purchase_bill,
    create_purchase_order,
    receive_goods,
    record_supplier_payment,
)
from app.services.supplier_credit import compute_payable, compute_payable_bulk

client = TestClient(app)


def _make_billed_supplier(db, tenant_ctx, *, name, price, qty, pay_amount=None):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    supplier = Supplier(tenant_id=tenant.id, company_id=company.id, name=name, opening_balance=Decimal("0"))
    db.add(supplier)
    db.flush()

    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"SUP-ITEM-{name}", name=f"Item for {name}",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=price, standard_cost=price,
    )
    db.add(item)
    db.flush()

    order = create_purchase_order(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        supplier_id=supplier.id, financial_year_id=fy.id,
        lines=[{"item_id": item.id, "qty": qty, "rate": price, "uom": "PCS"}],
    )
    approve_purchase_order(db, purchase_order_id=order.id)
    receipt = receive_goods(
        db, tenant_id=tenant.id, purchase_order_id=order.id, financial_year_id=fy.id, user_id=user_id,
        lines=[{"purchase_order_item_id": order.items[0].id, "qty_received": qty, "qc_status": "passed"}],
    )
    bill = create_purchase_bill(db, tenant_id=tenant.id, financial_year_id=fy.id, goods_receipt_id=receipt.id)

    if pay_amount is not None:
        record_supplier_payment(
            db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
            supplier_id=supplier.id, amount=pay_amount, mode="bank", purchase_bill_id=bill.id,
        )

    return supplier, bill


def test_compute_payable_bulk_matches_per_supplier_compute_payable(db, tenant_ctx):
    supplier, _bill = _make_billed_supplier(db, tenant_ctx, name="Fully Billed Co", price=Decimal("1000"), qty=Decimal("2"))
    supplier_paid, _bill2 = _make_billed_supplier(
        db, tenant_ctx, name="Partly Paid Co", price=Decimal("500"), qty=Decimal("4"), pay_amount=Decimal("1000"),
    )

    tenant = tenant_ctx["tenant"]
    bulk = compute_payable_bulk(db, tenant.id)

    assert bulk[supplier.id] == compute_payable(db, supplier.id)
    assert bulk[supplier_paid.id] == compute_payable(db, supplier_paid.id)
    # 4 * 500 = 2000 taxable, +18% GST = 2360 billed, 1000 paid -> 1360 still owed
    assert bulk[supplier_paid.id] == Decimal("1360.0000")


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


def test_suppliers_list_and_summary_http_roundtrip():
    slug = f"sup-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/suppliers", headers=headers,
        json={"name": "No GSTIN Supplier", "billing_state": "Andhra Pradesh", "category": "Raw Materials"},
    )
    assert create_resp.status_code == 201, create_resp.text
    supplier_id = create_resp.json()["id"]

    list_resp = client.get("/api/v1/suppliers", headers=headers)
    assert list_resp.status_code == 200
    row = next(s for s in list_resp.json() if s["id"] == supplier_id)
    assert row["category"] == "Raw Materials"
    assert row["outstanding_balance"] == "0.0000"  # a real number, not null, even with zero activity
    assert row["open_purchase_orders"] == 0

    summary_resp = client.get("/api/v1/suppliers/summary", headers=headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["total_suppliers"] == 1
    assert summary["missing_gstin_count"] == 1  # no GSTIN was given
    assert summary["active_purchase_orders"] == 0
    assert summary["total_outstanding"] == "0.0000"

    patch_resp = client.patch(f"/api/v1/suppliers/{supplier_id}", headers=headers, json={"gstin": "37AASCS1234F1Z5"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["gstin"] == "37AASCS1234F1Z5"

    summary_after_gstin = client.get("/api/v1/suppliers/summary", headers=headers).json()
    assert summary_after_gstin["missing_gstin_count"] == 0

    deactivate_resp = client.patch(f"/api/v1/suppliers/{supplier_id}", headers=headers, json={"is_active": False})
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["is_active"] is False

    # Default list call (e.g. a PO's supplier picker) must not offer a
    # deactivated supplier -- but the management page needs a way back to
    # it (include_inactive=true), or "Deactivate" would be a one-way door.
    default_list = client.get("/api/v1/suppliers", headers=headers).json()
    assert supplier_id not in [s["id"] for s in default_list]
    inclusive_list = client.get("/api/v1/suppliers?include_inactive=true", headers=headers).json()
    assert supplier_id in [s["id"] for s in inclusive_list]


def test_suppliers_patch_is_tenant_isolated():
    slug_a = f"sup-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"sup-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    create_resp = client.post(
        "/api/v1/suppliers", headers={"Authorization": f"Bearer {token_a}"}, json={"name": "Tenant A Supplier"},
    )
    supplier_id = create_resp.json()["id"]

    cross_tenant_patch = client.patch(
        f"/api/v1/suppliers/{supplier_id}", headers={"Authorization": f"Bearer {token_b}"}, json={"name": "Hijacked"},
    )
    assert cross_tenant_patch.status_code == 404
