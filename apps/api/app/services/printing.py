"""Printing Press profile (ADR-011). PrintJob is the one genuinely new
document type; billing reuses Invoice/InvoiceItem/the journal exactly
like services/pos.py does (same _post_invoice_journal import, same
reasoning: B13 says that arithmetic lives in one place).
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.inventory import StockBalance, StockReservation
from app.models.masters import Customer, Item
from app.models.printing import PrintJob, PrintJobArtwork
from app.models.sales import Invoice, InvoiceItem
from app.models.tenant import Company
from app.services.inventory import apply_ledger_movement
from app.services.invoicing import _post_invoice_journal
from app.services.money import round_invoice_total
from app.services.numbering import next_document_number
from app.services.receipts import record_receipt
from app.services.sales_common import resolve_place_of_supply

PRINT_CHARGES_SKU = "PRINT-SERVICE"

# Moving a job to or past this point requires its latest artwork
# version to be approved (sec14: "production must use the approved
# artwork version... prevent accidental use of an older version").
PRODUCTION_STATUSES = {"ready_to_print", "printing", "finishing", "qc", "packing"}


def get_or_create_print_charges_item(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> Item:
    """Anchor Item for InvoiceItem.item_id when a job has no catalogue
    item linked -- mirrors services/pos.py's walk-in-customer pattern.
    Its own gst_rate is never read for tax (see complete_job_and_invoice,
    which resolves tax off PrintJob.gst_rate instead) -- it would
    otherwise have to be mutated per job, and since this row is shared
    across every job at the company, that mutation would leak into
    whichever job invoices next and show up as a spurious audit-logged
    "gst_rate changed" on a row nobody touched.
    """
    existing = db.execute(
        select(Item).where(Item.tenant_id == tenant_id, Item.company_id == company_id, Item.sku == PRINT_CHARGES_SKU)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    item = Item(
        tenant_id=tenant_id, company_id=company_id, sku=PRINT_CHARGES_SKU, name="Print Job Charges",
        base_uom="JOB", gst_rate=Decimal("0"), standard_price=Decimal("0"),
    )
    db.add(item)
    db.flush()
    return item


def create_print_job(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    customer_id: uuid.UUID,
    project_id: uuid.UUID | None,
    item_id: uuid.UUID | None,
    job_type: str,
    specification: dict,
    quantity: Decimal,
    machine_id: uuid.UUID | None,
    media_item_id: uuid.UUID | None,
    media_qty: Decimal | None,
    warehouse_id: uuid.UUID | None,
    priority: str,
    due_date: date | None,
    quoted_price: Decimal,
    gst_rate: Decimal,
    notes: str | None,
) -> PrintJob:
    if db.get(Customer, customer_id) is None:
        raise AppError(ErrorCode.NOT_FOUND, "Customer not found.", status_code=404)

    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=_current_fy_id(db, company_id),
        doc_type="PRINT", default_prefix="PRINT",
    )
    job = PrintJob(
        tenant_id=tenant_id, number=number, company_id=company_id, branch_id=branch_id,
        customer_id=customer_id, project_id=project_id, item_id=item_id, job_type=job_type,
        specification=specification or {}, quantity=quantity, machine_id=machine_id,
        media_item_id=media_item_id, media_qty=media_qty, warehouse_id=warehouse_id,
        status="draft", priority=priority, due_date=due_date, quoted_price=quoted_price,
        gst_rate=gst_rate, notes=notes,
    )
    db.add(job)
    db.flush()
    return job


def _current_fy_id(db: Session, company_id: uuid.UUID) -> uuid.UUID:
    from app.services.numbering import get_current_financial_year

    return get_current_financial_year(db, company_id).id


def latest_artwork(db: Session, print_job_id: uuid.UUID) -> PrintJobArtwork | None:
    return db.execute(
        select(PrintJobArtwork)
        .where(PrintJobArtwork.print_job_id == print_job_id)
        .order_by(PrintJobArtwork.version_number.desc())
    ).scalars().first()


def upload_artwork(
    db: Session, *, tenant_id: uuid.UUID, print_job_id: uuid.UUID, file_name: str, storage_path: str,
    uploaded_by_user_id: uuid.UUID,
) -> PrintJobArtwork:
    job = db.get(PrintJob, print_job_id)
    if job is None:
        raise AppError(ErrorCode.NOT_FOUND, "Print job not found.", status_code=404)

    previous = latest_artwork(db, print_job_id)
    version_number = (previous.version_number + 1) if previous else 1
    artwork = PrintJobArtwork(
        tenant_id=tenant_id, print_job_id=print_job_id, version_number=version_number,
        file_name=file_name, storage_path=storage_path, uploaded_by_user_id=uploaded_by_user_id,
        status="submitted",
    )
    db.add(artwork)

    # A new version supersedes any prior approval -- sec14's "prevent
    # accidental use of an older version" means a fresh upload must not
    # silently keep production unlocked on the version it replaces.
    if job.status in ("draft", "quoted", "approved", "artwork_pending"):
        job.status = "artwork_pending"
    db.flush()
    return artwork


def approve_artwork(db: Session, *, artwork_id: uuid.UUID, approved_by_user_id: uuid.UUID) -> PrintJobArtwork:
    artwork = db.get(PrintJobArtwork, artwork_id)
    if artwork is None:
        raise AppError(ErrorCode.NOT_FOUND, "Artwork not found.", status_code=404)
    artwork.status = "approved"
    artwork.approved_by_user_id = approved_by_user_id
    artwork.approved_at = datetime.now(timezone.utc)
    db.flush()
    return artwork


def update_job_status(db: Session, *, print_job_id: uuid.UUID, new_status: str) -> PrintJob:
    job = db.get(PrintJob, print_job_id)
    if job is None:
        raise AppError(ErrorCode.NOT_FOUND, "Print job not found.", status_code=404)

    if new_status in PRODUCTION_STATUSES:
        latest = latest_artwork(db, print_job_id)
        if latest is None or latest.status != "approved":
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Production cannot start: the latest artwork version is not approved.",
                details={"job_id": str(print_job_id), "latest_artwork_status": latest.status if latest else None},
            )

    job.status = new_status
    db.flush()
    return job


def create_rework_job(db: Session, *, tenant_id: uuid.UUID, original_job_id: uuid.UUID) -> PrintJob:
    """sec27/28: a QC failure creates a new job linked to the original,
    not a mutation of it -- the original keeps its own (failed) cost/QC
    history, so job profitability on each stays honest instead of the
    rework silently overwriting what the first attempt actually cost."""
    original = db.get(PrintJob, original_job_id)
    if original is None:
        raise AppError(ErrorCode.NOT_FOUND, "Print job not found.", status_code=404)

    number = next_document_number(
        db, company_id=original.company_id, branch_id=original.branch_id,
        financial_year_id=_current_fy_id(db, original.company_id), doc_type="PRINT", default_prefix="PRINT",
    )
    rework = PrintJob(
        tenant_id=tenant_id, number=number, company_id=original.company_id, branch_id=original.branch_id,
        customer_id=original.customer_id, project_id=original.project_id, item_id=original.item_id,
        job_type=original.job_type, specification=dict(original.specification), quantity=original.quantity,
        machine_id=original.machine_id, media_item_id=original.media_item_id, media_qty=original.media_qty,
        warehouse_id=original.warehouse_id, status="approved", priority=original.priority,
        quoted_price=Decimal("0"), gst_rate=original.gst_rate, rework_of_job_id=original.id,
        notes=f"Rework of {original.number}",
    )
    db.add(rework)
    original.status = "rework"
    db.flush()
    return rework


def check_material_availability(db: Session, *, tenant_id: uuid.UUID, warehouse_id: uuid.UUID, item_id: uuid.UUID, qty: Decimal) -> Decimal:
    """Returns free stock. Raises INSUFFICIENT_STOCK if less than `qty`
    -- sec25's "Production blocked" check, read-only (no deduction)."""
    on_hand = db.execute(
        select(StockBalance.qty_on_hand).where(
            StockBalance.tenant_id == tenant_id, StockBalance.warehouse_id == warehouse_id, StockBalance.item_id == item_id
        )
    ).scalar_one_or_none() or Decimal("0")
    reserved = db.execute(
        select(func.coalesce(func.sum(StockReservation.qty), 0)).where(
            StockReservation.tenant_id == tenant_id, StockReservation.warehouse_id == warehouse_id,
            StockReservation.item_id == item_id, StockReservation.status == "active",
        )
    ).scalar_one()
    available = on_hand - Decimal(reserved)
    if available < qty:
        raise AppError(
            ErrorCode.INSUFFICIENT_STOCK, f"Only {available} available; {qty} required.", status_code=409,
            details={"available": str(available), "required": str(qty)},
        )
    return available


@dataclass
class JobProfitability:
    revenue: Decimal
    material_cost: Decimal
    printing_cost: Decimal
    finishing_cost: Decimal
    labor_cost: Decimal
    outsourcing_cost: Decimal
    wastage_cost: Decimal
    total_cost: Decimal
    gross_profit: Decimal
    margin_pct: Decimal


def job_profitability(job: PrintJob) -> JobProfitability:
    """sec44 -- computed on read from the job's own cost fields, not a
    stored/duplicated total (same "derive, don't duplicate" reasoning
    as compute_outstanding for customers)."""
    total_cost = (
        job.material_cost + job.printing_cost + job.finishing_cost
        + job.labor_cost + job.outsource_cost + job.wastage_cost
    )
    revenue = job.quoted_price
    gross_profit = revenue - total_cost
    margin_pct = (gross_profit / revenue * 100) if revenue else Decimal("0")
    return JobProfitability(
        revenue=revenue, material_cost=job.material_cost, printing_cost=job.printing_cost,
        finishing_cost=job.finishing_cost, labor_cost=job.labor_cost, outsourcing_cost=job.outsource_cost,
        wastage_cost=job.wastage_cost, total_cost=total_cost, gross_profit=gross_profit, margin_pct=margin_pct,
    )


def complete_job_and_invoice(
    db: Session, *, tenant_id: uuid.UUID, print_job_id: uuid.UUID, user_id: uuid.UUID,
    payment_amount: Decimal | None = None, payment_mode: str | None = None,
) -> PrintJob:
    """sec42-44: delivery -> invoice -> (optional immediate) payment ->
    profitability. Deducts media stock exactly like services/pos.py
    deducts sale items (B3) if the job has one linked; posts a real
    invoice + balanced journal (B5/B6) via the same _post_invoice_journal
    every other billing path in this codebase uses."""
    job = db.get(PrintJob, print_job_id)
    if job is None:
        raise AppError(ErrorCode.NOT_FOUND, "Print job not found.", status_code=404)
    if job.invoice_id is not None:
        raise AppError(ErrorCode.CONFLICT, "This job has already been invoiced.", status_code=409)

    company = db.get(Company, job.company_id)
    customer = db.get(Customer, job.customer_id)

    if job.media_item_id and job.media_qty and job.warehouse_id:
        check_material_availability(db, tenant_id=tenant_id, warehouse_id=job.warehouse_id, item_id=job.media_item_id, qty=job.media_qty)
        media_item = db.get(Item, job.media_item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=job.warehouse_id, item_id=job.media_item_id,
            qty=-job.media_qty, rate=media_item.standard_cost, movement_type="sale",
            reference_type="print_job", reference_id=job.id, user_id=user_id,
            occurred_at=datetime.now(timezone.utc),
        )

    today = date.today()
    place_of_supply = resolve_place_of_supply(site_state=None, customer=customer, company=company)

    if job.item_id is not None:
        invoice_item = db.get(Item, job.item_id)
        tax_source = invoice_item
    else:
        invoice_item = get_or_create_print_charges_item(db, tenant_id=tenant_id, company_id=job.company_id)
        tax_source = SimpleNamespace(gst_rate=job.gst_rate)

    from app.tax.resolve import resolve_tax

    tax = resolve_tax(
        document_date=today, place_of_supply_state=place_of_supply, company_state=company.state or "",
        item=tax_source, taxable_value=job.quoted_price,
    )
    rounded_total, round_off = round_invoice_total(job.quoted_price + tax.total_tax)

    number = next_document_number(
        db, company_id=job.company_id, branch_id=job.branch_id, financial_year_id=_current_fy_id(db, job.company_id),
        doc_type="INV", default_prefix="INV",
    )
    invoice = Invoice(
        tenant_id=tenant_id, number=number, company_id=job.company_id, branch_id=job.branch_id,
        customer_id=job.customer_id, project_id=job.project_id, sales_order_id=None, delivery_challan_id=None,
        invoice_date=today, place_of_supply_state=place_of_supply,
        subtotal=job.quoted_price, tax_total=tax.total_tax, round_off=round_off, total=rounded_total, status="posted",
    )
    db.add(invoice)
    db.flush()

    db.add(
        InvoiceItem(
            tenant_id=tenant_id, invoice_id=invoice.id, item_id=invoice_item.id, qty=Decimal("1"), uom="JOB",
            rate=job.quoted_price, cost=job.material_cost + job.printing_cost + job.finishing_cost + job.labor_cost + job.outsource_cost + job.wastage_cost,
            taxable_value=job.quoted_price, cgst_rate=tax.cgst_rate, sgst_rate=tax.sgst_rate, igst_rate=tax.igst_rate,
            cgst_amount=tax.cgst_amount, sgst_amount=tax.sgst_amount, igst_amount=tax.igst_amount,
            line_total=job.quoted_price + tax.total_tax,
        )
    )

    _post_invoice_journal(
        db, tenant_id=tenant_id, invoice=invoice, subtotal=job.quoted_price,
        cgst_total=tax.cgst_amount, sgst_total=tax.sgst_amount, igst_total=tax.igst_amount, round_off=round_off,
    )

    job.invoice_id = invoice.id
    job.status = "invoiced"
    db.flush()

    if payment_amount and payment_mode:
        record_receipt(
            db, tenant_id=tenant_id, company_id=job.company_id, branch_id=job.branch_id,
            financial_year_id=_current_fy_id(db, job.company_id), customer_id=job.customer_id,
            amount=payment_amount, mode=payment_mode, reference_note=f"Print job {job.number}", invoice_id=invoice.id,
        )

    return job
