"""ADR-016: the receipt template engine -- one normalized ReceiptData
shape across document types, fed by real transactions (not mocks), so
a broken assembler (e.g. a wrong field name) would show up as a real
assertion failure here the same way it would on a live receipt.
"""
import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.errors import AppError
from app.main import app
from app.models.masters import Item
from app.services.inventory import apply_ledger_movement
from app.services.pos import WalkInSaleLine, create_walk_in_sale
from app.services.receipt_templates import ensure_receipt_settings, get_receipt_data

client = TestClient(app)


def _seed_item(db, tenant, company, warehouse, user_id, *, sku, price):
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=sku, name=sku,
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=price, standard_cost=price / 2,
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id,
        qty=Decimal("50"), rate=price / 2, movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    return item


def test_receipt_settings_seeded_with_sane_defaults_and_idempotent(db, tenant_ctx):
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]
    settings = ensure_receipt_settings(db, tenant_id=tenant.id, company_id=company.id)
    assert settings.default_paper_width_mm == 80
    assert settings.show_logo is True
    assert settings.show_qr_code is False  # off until a real UPI ID is configured

    again = ensure_receipt_settings(db, tenant_id=tenant.id, company_id=company.id)
    assert again.id == settings.id


def test_pos_receipt_normalizes_walk_in_sale_into_receipt_data(db, tenant_ctx):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RCPT-ITEM", price=Decimal("100.00"))

    sale = create_walk_in_sale(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        financial_year_id=fy.id, user_id=user_id, customer_id=None,
        lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("2"), uom="PCS")],
        cash_amount=Decimal("236.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"), tendered_amount=Decimal("250.00"),
    )

    receipt = get_receipt_data(db, tenant_id=tenant.id, document_type="pos_receipt", document_id=sale.id)
    assert receipt.document_type == "pos_receipt"
    assert len(receipt.items) == 1
    assert receipt.items[0].name == "RCPT-ITEM"
    assert receipt.items[0].qty == Decimal("2")
    assert receipt.subtotal == Decimal("200.00")
    assert receipt.grand_total == Decimal("236.00")
    assert receipt.cgst_amount + receipt.sgst_amount == Decimal("36.00")
    assert receipt.payment_method == "Cash ₹236.00"
    assert receipt.change_due == Decimal("14.00")
    assert receipt.settings.default_paper_width_mm == 80  # the tenant's real, seeded settings, not a hardcoded default here


def test_invoice_document_type_shares_the_same_assembler(db, tenant_ctx):
    """spec: "don't hardcode receipt layouts into individual modules" --
    pos_receipt and invoice both normalize from the same underlying
    Invoice/InvoiceItem rows via the same _from_invoice() function."""
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RCPT-ITEM2", price=Decimal("50.00"))
    sale = create_walk_in_sale(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        financial_year_id=fy.id, user_id=user_id, customer_id=None,
        lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("1"), uom="PCS")],
        cash_amount=Decimal("59.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"), tendered_amount=Decimal("59.00"),
    )

    from app.models.pos import WalkInSale

    invoice_id = db.get(WalkInSale, sale.id).invoice_id
    invoice_receipt = get_receipt_data(db, tenant_id=tenant.id, document_type="invoice", document_id=invoice_id)
    pos_receipt = get_receipt_data(db, tenant_id=tenant.id, document_type="pos_receipt", document_id=sale.id)

    assert invoice_receipt.grand_total == pos_receipt.grand_total == Decimal("59.00")
    assert invoice_receipt.items[0].name == pos_receipt.items[0].name


def test_unknown_document_type_is_rejected(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    with pytest.raises(AppError) as exc_info:
        get_receipt_data(db, tenant_id=tenant.id, document_type="not_a_real_type", document_id=uuid.uuid4())
    assert exc_info.value.code.value == "VALIDATION_ERROR"


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


def test_receipt_settings_http_roundtrip_and_cross_tenant_isolation():
    slug_a = f"rcpt-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"rcpt-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    update_resp = client.put("/api/v1/receipt-settings", headers=headers_a, json={"footer_message": "Thanks for shopping with us!", "default_paper_width_mm": 58})
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["footer_message"] == "Thanks for shopping with us!"
    assert update_resp.json()["default_paper_width_mm"] == 58

    # Tenant B's settings are untouched -- still the real defaults, not tenant A's.
    settings_b = client.get("/api/v1/receipt-settings", headers=headers_b).json()
    assert settings_b["footer_message"] is None
    assert settings_b["default_paper_width_mm"] == 80

    unknown_type_resp = client.get(f"/api/v1/receipts/not_a_real_type/{uuid.uuid4()}", headers=headers_a)
    assert unknown_type_resp.status_code == 400
    assert unknown_type_resp.json()["error"]["code"] == "VALIDATION_ERROR"
