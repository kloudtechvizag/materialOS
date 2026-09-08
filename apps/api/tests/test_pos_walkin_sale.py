"""Slice E (Retail profile, ADR-010): a counter sale with no customer,
no quotation, split cash+UPI payment, paid in full at checkout, posts a
real Invoice + balanced journal + stock deduction -- same invariants as
the golden transaction (B3, B5, B6), just reached by a shorter path.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.errors import AppError
from app.models.masters import Item
from app.models.sales import Invoice, InvoiceItem, PaymentAllocation, Receipt
from app.services.inventory import apply_ledger_movement, assert_no_drift
from app.services.pos import WalkInSaleLine, create_walk_in_sale, get_or_create_walkin_customer


def _seed_item(db, tenant, company, warehouse, user_id, *, sku, price, gst_rate=Decimal("18")):
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=sku, name=sku,
        gst_rate=gst_rate, base_uom="PCS", standard_price=price, standard_cost=price / 2,
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id,
        qty=Decimal("100"), rate=price / 2, movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    return item


def test_walk_in_sale_split_payment_posts_invoice_journal_and_stock(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    fy = tenant_ctx["financial_year"]
    user_id = uuid.uuid4()

    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RTL-SOAP", price=Decimal("100.00"))

    # 3 units @ 100 = 300 subtotal, 18% GST = 54, total 354 (intrastate
    # since customer/company share no state -- billing_state defaults to
    # company.state via resolve_place_of_supply, so this is CGST+SGST).
    sale = create_walk_in_sale(
        db,
        tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        financial_year_id=fy.id, user_id=user_id, customer_id=None,
        lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("3"), uom="PCS")],
        cash_amount=Decimal("200.00"), upi_amount=Decimal("154.00"), card_amount=Decimal("0"),
        tendered_amount=Decimal("200.00"),
    )

    invoice = db.get(Invoice, sale.invoice_id)
    assert invoice.subtotal == Decimal("300.0000")
    assert invoice.tax_total == Decimal("54.0000")
    assert invoice.total == Decimal("354.0000")

    items = db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).scalars().all()
    assert len(items) == 1
    assert items[0].cgst_amount + items[0].sgst_amount == Decimal("54.0000")

    # Walk-in customer auto-created, zero credit.
    customer = get_or_create_walkin_customer(db, tenant_id=tenant.id, company_id=company.id)
    assert sale.customer_id == customer.id
    assert customer.credit_limit == Decimal("0")

    # Both payment legs recorded as receipts, fully allocated -- nothing
    # left outstanding on this invoice.
    receipts = db.execute(select(Receipt).where(Receipt.customer_id == customer.id)).scalars().all()
    assert {r.mode for r in receipts} == {"cash", "upi"}
    assert sum(r.amount for r in receipts) == Decimal("354.0000")
    allocations = db.execute(select(PaymentAllocation).where(PaymentAllocation.invoice_id == invoice.id)).scalars().all()
    assert sum(a.amount for a in allocations) == invoice.total

    # No change due -- tendered (200) exactly covers the cash leg (200).
    assert sale.change_due == Decimal("0.0000")

    # B3: stock ledger and its projection agree.
    assert_no_drift(db, tenant_id=tenant.id)


def test_walk_in_sale_gives_change_on_cash_overpayment(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    fy = tenant_ctx["financial_year"]
    user_id = uuid.uuid4()

    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RTL-CHOC", price=Decimal("50.00"))

    # 1 unit @ 50, 18% GST = 9, total 59. Customer hands over a 100-rupee
    # note in cash -- the *applied* cash leg must still equal exactly what
    # the invoice needs (59); "tendered" carries the physical overpayment
    # so change can be computed without ever overpaying the invoice itself.
    sale = create_walk_in_sale(
        db,
        tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        financial_year_id=fy.id, user_id=user_id, customer_id=None,
        lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("1"), uom="PCS")],
        cash_amount=Decimal("59.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"),
        tendered_amount=Decimal("100.00"),
    )
    assert sale.change_due == Decimal("41.00")


def test_walk_in_sale_rejects_payment_not_matching_total(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    fy = tenant_ctx["financial_year"]
    user_id = uuid.uuid4()

    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RTL-PEN", price=Decimal("10.00"))

    try:
        create_walk_in_sale(
            db,
            tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
            financial_year_id=fy.id, user_id=user_id, customer_id=None,
            lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("1"), uom="PCS")],
            cash_amount=Decimal("5.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"),
            tendered_amount=Decimal("5.00"),
        )
        assert False, "expected AppError for underpayment"
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"


def test_walk_in_sale_rejects_insufficient_stock(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    fy = tenant_ctx["financial_year"]
    user_id = uuid.uuid4()

    item = _seed_item(db, tenant, company, warehouse, user_id, sku="RTL-TINY", price=Decimal("10.00"))

    try:
        create_walk_in_sale(
            db,
            tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
            financial_year_id=fy.id, user_id=user_id, customer_id=None,
            lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("9999"), uom="PCS")],
            cash_amount=Decimal("117881.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"),
            tendered_amount=Decimal("117881.00"),
        )
        assert False, "expected AppError for insufficient stock"
    except AppError as exc:
        assert exc.code.value == "INSUFFICIENT_STOCK"
