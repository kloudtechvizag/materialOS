"""Slice 3: Purchase Request -> PO -> Goods Receipt -> QC -> Purchase
Bill -> Payment, with landed cost allocation, plus the collections
ageing/DSO module the acceptance test ("DSO measurably drops") depends on.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.models.masters import Customer, Item, Supplier
from app.models.sales import Invoice
from app.services.collections import ageing_report, compute_dso
from app.services.inventory import assert_no_drift
from app.services.procurement import (
    allocate_landed_cost,
    approve_purchase_order,
    create_purchase_bill,
    create_purchase_order,
    receive_goods,
    record_supplier_payment,
)
from app.services.supplier_credit import compute_payable


def test_purchase_to_payment_with_landed_cost(db, tenant_ctx):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()

    supplier = Supplier(
        tenant_id=tenant.id, company_id=company.id, name="UltraTech Distributors", billing_state="Andhra Pradesh",
    )
    db.add(supplier)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="CEM-TEST", name="Test Cement", hsn_code="2523",
        gst_rate=Decimal("18"), base_uom="BAG", standard_cost=Decimal("0"),
    )
    db.add(item)
    db.flush()

    order = create_purchase_order(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        supplier_id=supplier.id, financial_year_id=fy.id,
        lines=[{"item_id": item.id, "qty": Decimal("500"), "rate": Decimal("300"), "uom": "BAG"}],
    )
    assert order.subtotal == Decimal("150000")

    approve_purchase_order(db, purchase_order_id=order.id)

    poi = order.items[0]
    receipt = receive_goods(
        db, tenant_id=tenant.id, purchase_order_id=order.id, financial_year_id=fy.id,
        lines=[{"purchase_order_item_id": poi.id, "qty_received": Decimal("500"), "qc_status": "passed"}],
        user_id=user_id,
    )
    db.refresh(order)
    assert order.status == "received"
    assert_no_drift(db, tenant_id=tenant.id)

    # Freight of 5000 allocated by value across (here) a single line ->
    # entire 5000 lands on this line -> extra Rs 10/bag -> cost becomes 310.
    receipt = allocate_landed_cost(
        db, tenant_id=tenant.id, goods_receipt_id=receipt.id, cost_type="freight", amount=Decimal("5000"),
        allocation_method="value",
    )
    db.refresh(item)
    assert item.standard_cost == Decimal("310.0000")
    assert receipt.items[0].landed_unit_cost == Decimal("310.0000")

    bill = create_purchase_bill(db, tenant_id=tenant.id, financial_year_id=fy.id, goods_receipt_id=receipt.id)
    # Billed at the PO rate (300/bag), not landed cost -- that's what the supplier actually invoices.
    assert bill.subtotal == Decimal("150000")
    assert bill.tax_total == Decimal("27000.00")  # 18% intrastate: 13500 CGST + 13500 SGST
    assert bill.total == Decimal("177000.00")

    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    payable_before = compute_payable(db, supplier.id)
    assert payable_before == bill.total

    record_supplier_payment(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        supplier_id=supplier.id, amount=Decimal("100000"), mode="bank",
    )
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    payable_after = compute_payable(db, supplier.id)
    assert payable_after == payable_before - Decimal("100000")


def test_ageing_and_dso(db, tenant_ctx):
    """Directly manipulates invoice_date to exercise ageing-bucket math --
    a normal unit-test technique, not seed-data fabrication (no journal
    or ledger entries are backdated to match, so this never claims to be
    a real historical record).
    """
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    customer = Customer(
        tenant_id=tenant.id, company_id=company.id, name="Overdue Co", billing_state="Andhra Pradesh", credit_days=15,
    )
    db.add(customer)
    db.flush()

    from app.services.invoicing import create_invoice_from_challan
    from app.services.dispatch import create_delivery_challan
    from app.services.quotation import create_quotation
    from app.services.sales_order import create_sales_order_from_quotation
    from app.services.inventory import apply_ledger_movement

    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="AGE-TEST", name="Ageing Test Item", hsn_code="2523",
        gst_rate=Decimal("18"), base_uom="BAG", standard_price=Decimal("100"), standard_cost=Decimal("80"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("100"), rate=Decimal("80"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )

    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": Decimal("10"), "uom": "BAG"}],
    )
    quotation.status = "approved"
    db.flush()
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id,
        requested_by_user_id=uuid.uuid4(),
    )
    challan = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=order.id, financial_year_id=fy.id, user_id=uuid.uuid4())
    invoice = create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=challan.id, financial_year_id=fy.id)

    # Backdate for the ageing test only -- 40 days ago, 15-day credit terms -> 25 days overdue.
    invoice.invoice_date = date.today() - timedelta(days=40)
    db.flush()

    lines = ageing_report(db)
    matching = [ln for ln in lines if ln.invoice_id == invoice.id]
    assert len(matching) == 1
    assert matching[0].days_overdue == 25
    assert matching[0].bucket == "16-30"

    dso = compute_dso(db, period_days=60)
    assert dso is not None
    assert dso > 0
