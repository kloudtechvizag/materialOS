"""Printing Press profile (ADR-011) golden workflow: Customer -> Job ->
Artwork upload -> (blocked) production -> artwork approved -> production
-> complete -> real Invoice + balanced journal + media stock deduction
-> job profitability. Exercises the one explicitly-required business
rule (sec14): production cannot start on an unapproved artwork version.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.errors import AppError
from app.models.masters import Customer, Item
from app.models.sales import Invoice, InvoiceItem
from app.services.inventory import apply_ledger_movement, assert_no_drift
from app.services.printing import (
    approve_artwork,
    check_material_availability,
    complete_job_and_invoice,
    create_print_job,
    create_rework_job,
    job_profitability,
    update_job_status,
    upload_artwork,
)


def _customer(db, tenant, company):
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="ABC Enterprises")
    db.add(customer)
    db.flush()
    return customer


def _media_item(db, tenant, company, warehouse, user_id, *, qty=Decimal("500")):
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="MEDIA-300GSM-ARTCARD", name="300 GSM Art Card",
        base_uom="SHEET", gst_rate=Decimal("18"), standard_price=Decimal("0"), standard_cost=Decimal("2.50"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id,
        qty=qty, rate=Decimal("2.50"), movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    return item


def test_golden_print_job_workflow(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    user_id = uuid.uuid4()

    customer = _customer(db, tenant, company)
    media = _media_item(db, tenant, company, warehouse, user_id)

    job = create_print_job(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, customer_id=customer.id,
        project_id=None, item_id=None, job_type="Business Cards",
        specification={"size": "90x55mm", "paper": "300 GSM Art Card", "sides": "front+back"},
        quantity=Decimal("5000"), machine_id=None, media_item_id=media.id, media_qty=Decimal("220"),
        warehouse_id=warehouse.id, priority="urgent", due_date=None,
        quoted_price=Decimal("25000.00"), gst_rate=Decimal("18"), notes=None,
    )
    assert job.status == "draft"
    assert job.number.startswith("PRINT-")

    # sec14: cannot enter production with no approved artwork.
    try:
        update_job_status(db, print_job_id=job.id, new_status="printing")
        assert False, "expected production to be blocked with no approved artwork"
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"

    artwork_v1 = upload_artwork(
        db, tenant_id=tenant.id, print_job_id=job.id, file_name="business-card-v1.pdf",
        storage_path="fake/path/v1.pdf", uploaded_by_user_id=user_id,
    )
    assert artwork_v1.version_number == 1
    db.refresh(job)
    assert job.status == "artwork_pending"

    # Still blocked -- uploaded, not yet approved.
    try:
        update_job_status(db, print_job_id=job.id, new_status="printing")
        assert False, "expected production to still be blocked before approval"
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"

    approve_artwork(db, artwork_id=artwork_v1.id, approved_by_user_id=user_id)
    job = update_job_status(db, print_job_id=job.id, new_status="printing")
    assert job.status == "printing"

    job.material_cost = Decimal("5500")
    job.printing_cost = Decimal("3000")
    job.finishing_cost = Decimal("2000")
    job.labor_cost = Decimal("1500")
    job.wastage_cost = Decimal("0")
    db.flush()

    completed = complete_job_and_invoice(
        db, tenant_id=tenant.id, print_job_id=job.id, user_id=user_id,
        payment_amount=Decimal("29500.00"), payment_mode="cash",
    )
    assert completed.status == "invoiced"
    assert completed.invoice_id is not None

    invoice = db.get(Invoice, completed.invoice_id)
    assert invoice.subtotal == Decimal("25000.0000")
    assert invoice.tax_total == Decimal("4500.0000")  # 18% of 25000
    assert invoice.total == Decimal("29500.0000")

    items = db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).scalars().all()
    assert len(items) == 1
    assert items[0].qty == Decimal("1.0000")

    # Media stock deducted (220 consumed out of 500 opening).
    assert_no_drift(db, tenant_id=tenant.id)

    profitability = job_profitability(completed)
    assert profitability.total_cost == Decimal("12000")
    assert profitability.gross_profit == Decimal("13000")
    assert profitability.margin_pct == Decimal("52")

    # Cannot invoice twice.
    try:
        complete_job_and_invoice(db, tenant_id=tenant.id, print_job_id=job.id, user_id=user_id)
        assert False, "expected re-invoicing to be rejected"
    except AppError as exc:
        assert exc.code.value == "CONFLICT"


def test_qc_failure_creates_linked_rework_job(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    user_id = uuid.uuid4()

    customer = _customer(db, tenant, company)
    job = create_print_job(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, customer_id=customer.id,
        project_id=None, item_id=None, job_type="Flyers", specification={}, quantity=Decimal("1000"),
        machine_id=None, media_item_id=None, media_qty=None, warehouse_id=None, priority="normal",
        due_date=None, quoted_price=Decimal("5000"), gst_rate=Decimal("18"), notes=None,
    )
    job.status = "qc"
    job.qc_status = "reject"
    job.qc_notes = "Color mismatch"
    db.flush()

    rework = create_rework_job(db, tenant_id=tenant.id, original_job_id=job.id)
    assert rework.rework_of_job_id == job.id
    assert rework.job_type == job.job_type
    assert rework.status == "approved"  # skips re-quoting, per sec27/28

    db.refresh(job)
    assert job.status == "rework"


def test_check_material_availability_raises_when_insufficient(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    warehouse = tenant_ctx["warehouse"]
    user_id = uuid.uuid4()

    media = _media_item(db, tenant, company, warehouse, user_id, qty=Decimal("50"))

    try:
        check_material_availability(db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=media.id, qty=Decimal("220"))
        assert False, "expected INSUFFICIENT_STOCK"
    except AppError as exc:
        assert exc.code.value == "INSUFFICIENT_STOCK"
