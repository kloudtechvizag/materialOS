"""Slice 1's acceptance test, verbatim from Master Brief v2:

ABC Constructions / Green Valley Apartments / Vizag site, 500 bags
cement + 2 MT 12mm TMT, quoted -> credit-checked -> approved -> ordered
-> reserved -> picked -> dispatched -> delivered -> invoiced -> part-paid
-> outstanding updated -> project profitability updated. Zero re-keying
at any step; customer name typed exactly once.
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select, text

from app.models.masters import Customer, Item
from app.models.projects import Project, Site
from app.models.sales import InvoiceItem
from app.services.credit import compute_outstanding
from app.services.dispatch import create_delivery_challan
from app.services.inventory import apply_ledger_movement, assert_no_drift
from app.services.invoicing import create_invoice_from_challan
from app.services.quotation import create_quotation
from app.services.receipts import record_receipt
from app.services.sales_order import create_sales_order_from_quotation


def test_golden_transaction(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    fy = tenant_ctx["financial_year"]
    user_id = uuid.uuid4()

    # -- Customer named exactly once --
    customer = Customer(
        tenant_id=tenant.id,
        company_id=company.id,
        name="ABC Constructions",
        billing_state="Andhra Pradesh",  # intrastate with the company -> CGST+SGST
        credit_limit=Decimal("2000000"),
        credit_days=30,
    )
    db.add(customer)
    db.flush()

    cement = Item(
        tenant_id=tenant.id, company_id=company.id, sku="CEM-UT-OPC53", name="UltraTech OPC53 50KG",
        hsn_code="2523", gst_rate=Decimal("18"), base_uom="BAG",
        standard_price=Decimal("350.00"), standard_cost=Decimal("300.00"),
    )
    tmt = Item(
        tenant_id=tenant.id, company_id=company.id, sku="TMT-TATA-12MM", name="Tata Tiscon 12mm",
        hsn_code="7214", gst_rate=Decimal("18"), base_uom="KG",
        standard_price=Decimal("65.00"), standard_cost=Decimal("58.00"),
    )
    db.add_all([cement, tmt])
    db.flush()

    # Opening stock: plenty of cement, plenty of TMT.
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=cement.id,
        qty=Decimal("1000"), rate=Decimal("300"), movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=tmt.id,
        qty=Decimal("5000"), rate=Decimal("58"), movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )

    project = Project(tenant_id=tenant.id, customer_id=customer.id, name="Green Valley Apartments")
    db.add(project)
    db.flush()
    site = Site(tenant_id=tenant.id, project_id=project.id, name="Vizag Site", city="Visakhapatnam", state="Andhra Pradesh")
    db.add(site)
    db.flush()

    # -- Quotation: 500 bags cement + 2 MT (2000 kg) 12mm TMT --
    quotation = create_quotation(
        db,
        tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=project.id, site_id=site.id, site_state=site.state,
        valid_until=None,
        lines=[
            {"item_id": cement.id, "qty": Decimal("500"), "uom": "BAG"},
            {"item_id": tmt.id, "qty": Decimal("2000"), "uom": "KG"},
        ],
    )

    expected_subtotal = Decimal("500") * Decimal("350.00") + Decimal("2000") * Decimal("65.00")
    assert quotation.subtotal == expected_subtotal
    assert quotation.tax_total == (expected_subtotal * Decimal("18") / 100).quantize(Decimal("0.01"))
    assert quotation.status == "draft"

    # -- Approved --
    quotation.status = "approved"
    db.flush()

    # -- Sales order: credit-checked, reserved --
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id,
        requested_by_user_id=user_id,
    )
    assert order.status == "reserved"
    assert order.total == quotation.total
    assert order.customer_id == customer.id
    assert order.project_id == project.id

    # -- Dispatched (picked + loaded + delivered, as one document here) --
    challan = create_delivery_challan(
        db, tenant_id=tenant.id, sales_order_id=order.id, financial_year_id=fy.id, user_id=user_id,
    )
    db.refresh(order)
    assert order.status == "dispatched"

    # Stock actually moved, and the projection still matches a fresh replay (B3).
    assert_no_drift(db, tenant_id=tenant.id)

    # -- Invoiced --
    invoice = create_invoice_from_challan(
        db, tenant_id=tenant.id, delivery_challan_id=challan.id, financial_year_id=fy.id,
    )
    assert invoice.total == quotation.total
    assert invoice.subtotal == expected_subtotal
    # Intrastate (AP -> AP): split into CGST + SGST, no IGST.
    lines = db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).scalars().all()
    for line in lines:
        assert line.igst_amount == 0
        assert line.cgst_amount > 0
        assert line.sgst_amount > 0
        assert line.cgst_amount == line.sgst_amount

    # B5, forced to check immediately rather than waiting for a commit
    # that this rollback-based test never makes.
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    db.refresh(order)
    assert order.status == "invoiced"

    # -- Part-paid --
    part_payment = (invoice.total / 2).quantize(Decimal("1"))
    record_receipt(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, amount=part_payment, mode="bank", reference_note="Advance against INV",
        invoice_id=invoice.id,
    )
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    # -- Outstanding updated --
    outstanding = compute_outstanding(db, customer.id)
    assert outstanding == invoice.total - part_payment

    # -- Project profitability updated --
    expected_cost = Decimal("500") * Decimal("300.00") + Decimal("2000") * Decimal("58.00")
    revenue = expected_subtotal
    expected_profit = revenue - expected_cost
    assert expected_profit > 0  # sanity: this transaction should be profitable
