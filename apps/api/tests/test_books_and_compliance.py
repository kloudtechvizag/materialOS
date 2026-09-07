"""Slice 4 acceptance test, from Master Brief v2: "a chartered accountant
files a full month's GSTR-1 from MaterialOS output without touching
Tally, and the trial balance ties."
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import text

from app.einvoice.gateway import SandboxEInvoiceGateway
from app.einvoice.service import cancel_irn, generate_irn
from app.ewaybill.gateway import SandboxEWayBillGateway
from app.ewaybill.service import cancel_ewb, generate_ewb
from app.errors import AppError
from app.models.masters import Customer, Item
from app.services.accounting_reports import balance_sheet, profit_and_loss, trial_balance
from app.services.dispatch import create_delivery_challan
from app.services.gst_reports import gstr1_extract
from app.services.inventory import apply_ledger_movement
from app.services.invoicing import create_invoice_from_challan
from app.services.quotation import create_quotation
from app.services.sales_order import create_sales_order_from_quotation
from app.services.tally_export import export_period_to_tally_xml


def _make_invoiced_customer(db, tenant_ctx, *, name, gstin, qty=Decimal("50")):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name=name, gstin=gstin, billing_state="Andhra Pradesh")
    db.add(customer)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"SKU-{uuid.uuid4().hex[:6]}", name="Cement Bag",
        hsn_code="2523", gst_rate=Decimal("18"), base_uom="BAG", standard_price=Decimal("350"), standard_cost=Decimal("300"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("1000"), rate=Decimal("300"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": qty, "uom": "BAG"}],
    )
    quotation.status = "approved"
    db.flush()
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id,
        requested_by_user_id=user_id,
    )
    challan = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=order.id, financial_year_id=fy.id, user_id=user_id)
    invoice = create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=challan.id, financial_year_id=fy.id)
    return customer, item, invoice


def test_trial_balance_ties_after_mixed_transactions(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")
    _make_invoiced_customer(db, tenant_ctx, name="Walk-in Customer", gstin=None, qty=Decimal("10"))

    from sqlalchemy import text as sql_text

    db.execute(sql_text("SET CONSTRAINTS ALL IMMEDIATE"))

    lines = trial_balance(db, as_of=date.today())
    total_debit = sum((line.debit for line in lines), Decimal("0"))
    total_credit = sum((line.credit for line in lines), Decimal("0"))
    assert total_debit == total_credit
    assert total_debit > 0


def test_profit_and_loss_and_balance_sheet_are_consistent(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")

    from sqlalchemy import text as sql_text

    db.execute(sql_text("SET CONSTRAINTS ALL IMMEDIATE"))

    pnl = profit_and_loss(db, from_date=date.today().replace(day=1), to_date=date.today())
    assert pnl.total_income == Decimal("17500.0000")  # 50 bags * 350
    assert pnl.net_profit == pnl.total_income - pnl.total_expense

    bs = balance_sheet(db, as_of=date.today())
    # Assets = Liabilities + Equity(computed) must hold by construction (ADR-008).
    assert bs.total_assets == bs.total_liabilities + bs.retained_earnings


def test_gstr1_extract_splits_b2b_and_b2cs_correctly(db, tenant_ctx):
    _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5", qty=Decimal("50"))
    _make_invoiced_customer(db, tenant_ctx, name="Walk-in Customer", gstin=None, qty=Decimal("10"))

    today = date.today()
    extract = gstr1_extract(db, month=today.month, year=today.year)

    assert len(extract.b2b) == 1
    assert extract.b2b[0].customer_gstin == "37ABCDE1234F1Z5"
    assert extract.b2b[0].taxable_value == Decimal("17500.0000")

    assert len(extract.b2cs) == 1
    assert extract.b2cs[0].taxable_value == Decimal("3500.0000")  # 10 * 350

    assert len(extract.hsn_summary) == 1
    assert extract.hsn_summary[0].hsn_code == "2523"
    assert extract.hsn_summary[0].total_qty == Decimal("60.0000")  # 50 + 10


def test_einvoice_sandbox_generate_and_cancel(db, tenant_ctx):
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]
    company.e_invoice_enabled = True
    db.flush()
    _customer, _item, invoice = _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")

    e_invoice = generate_irn(db, tenant_id=tenant.id, invoice_id=invoice.id)
    assert len(e_invoice.irn) == 64  # sha256 hex digest length -- sandbox mirrors the real IRN's shape
    assert e_invoice.ack_number.startswith("SANDBOX-")
    assert e_invoice.status == "generated"

    cancelled = cancel_irn(db, e_invoice_id=e_invoice.id, reason="Test cancellation")
    assert cancelled.status == "cancelled"


def test_einvoice_requires_company_flag(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    _customer, _item, invoice = _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")
    try:
        generate_irn(db, tenant_id=tenant.id, invoice_id=invoice.id)
        raise AssertionError("expected an error when e-invoicing is not enabled")
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"


def test_ewaybill_180_day_guard_and_validity(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    _customer, _item, invoice = _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")

    ewb = generate_ewb(db, tenant_id=tenant.id, invoice_id=invoice.id, vehicle_number="AP31AB1234", distance_km=Decimal("450"))
    assert ewb.ewb_number.startswith("SBX")
    # 450 km / 200 km-per-day = 2.25 -> ceil to 3 days validity.
    assert (ewb.valid_until - ewb.generated_at).days == 3

    invoice.invoice_date = date.today().replace(year=date.today().year - 1)
    db.flush()
    try:
        generate_ewb(db, tenant_id=tenant.id, invoice_id=invoice.id, vehicle_number="AP31AB1234", distance_km=Decimal("100"))
        raise AssertionError("expected EWB_DOCUMENT_TOO_OLD")
    except AppError as exc:
        assert exc.code.value == "EWB_DOCUMENT_TOO_OLD"


def test_tally_export_produces_wellformed_xml_with_expected_vouchers(db, tenant_ctx):
    import xml.etree.ElementTree as ET

    company = tenant_ctx["company"]
    _make_invoiced_customer(db, tenant_ctx, name="ABC Constructions", gstin="37ABCDE1234F1Z5")

    xml_str = export_period_to_tally_xml(db, company_id=company.id, from_date=date.today().replace(day=1), to_date=date.today())
    root = ET.fromstring(xml_str)  # raises if malformed
    vouchers = root.findall(".//VOUCHER")
    assert len(vouchers) == 1
    assert vouchers[0].get("VCHTYPE") == "Sales"
    ledger_entries = vouchers[0].findall("ALLLEDGERENTRIES.LIST")
    assert len(ledger_entries) >= 2
    total_debit_minus_credit = sum(Decimal(le.find("AMOUNT").text) for le in ledger_entries)
    assert total_debit_minus_credit == Decimal("0.00")
