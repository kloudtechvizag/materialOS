import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Student, StudentEnrolment, StudentGuardian
from app.models.fees import FeeHead, FeeInvoice, FeeInvoiceLine, FeeStructureItem
from app.models.masters import Customer, Item
from app.models.sales import Invoice, InvoiceItem, PaymentAllocation
from app.models.tenant import Company
from app.services.invoicing import _post_invoice_journal
from app.services.money import round_invoice_total
from app.services.numbering import get_current_financial_year, next_document_number
from app.services.sales_common import resolve_place_of_supply
from app.services.notification_rules import fire_trigger
from app.services.webhooks import emit_event
from app.tax.resolve import resolve_tax


def create_fee_head(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str, code: str) -> FeeHead:
    """Every fee head gets its own real, dedicated Item so its
    invoice lines run through the exact tax/journal code every other
    invoice in this codebase does -- gst_rate=0 since school tuition
    and allied fees are GST-exempt (education services) in India."""
    item = Item(
        tenant_id=tenant_id, company_id=company_id, sku=f"FEE-{code}", name=name,
        base_uom="TERM", gst_rate=Decimal("0"),
    )
    db.add(item)
    db.flush()

    fee_head = FeeHead(tenant_id=tenant_id, company_id=company_id, item_id=item.id, name=name, code=code)
    db.add(fee_head)
    db.flush()
    return fee_head


def list_fee_heads(db: Session, *, tenant_id: uuid.UUID) -> list[FeeHead]:
    return db.execute(select(FeeHead).where(FeeHead.tenant_id == tenant_id).order_by(FeeHead.name)).scalars().all()


def create_fee_structure_item(
    db: Session, *, tenant_id: uuid.UUID, academic_year_id: uuid.UUID, school_class_id: uuid.UUID,
    fee_head_id: uuid.UUID, amount: Decimal, due_date: date,
) -> FeeStructureItem:
    if amount <= 0:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Fee amount must be greater than zero.")
    item = FeeStructureItem(
        tenant_id=tenant_id, academic_year_id=academic_year_id, school_class_id=school_class_id,
        fee_head_id=fee_head_id, amount=amount, due_date=due_date,
    )
    db.add(item)
    db.flush()
    return item


def list_fee_structure_items(db: Session, *, tenant_id: uuid.UUID, academic_year_id: uuid.UUID, school_class_id: uuid.UUID | None = None) -> list[FeeStructureItem]:
    stmt = select(FeeStructureItem).where(FeeStructureItem.tenant_id == tenant_id, FeeStructureItem.academic_year_id == academic_year_id)
    if school_class_id:
        stmt = stmt.where(FeeStructureItem.school_class_id == school_class_id)
    return db.execute(stmt).scalars().all()


def get_or_create_guardian_customer(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, guardian) -> Customer:
    """Lazy billing-party link (same pattern as services/pos.py's
    get_or_create_walkin_customer) -- a guardian only gets a real
    Customer row the first time fees are actually invoiced for them,
    not speculatively at guardian-creation time."""
    if guardian.customer_id is not None:
        customer = db.get(Customer, guardian.customer_id)
        if customer is not None:
            return customer

    customer = Customer(
        tenant_id=tenant_id, company_id=company_id, name=guardian.full_name,
        phone=guardian.phone, email=guardian.email, billing_state=guardian.state,
        credit_limit=Decimal("0"), credit_days=0,
    )
    db.add(customer)
    db.flush()
    guardian.customer_id = customer.id
    db.flush()
    return customer


def _primary_guardian(db: Session, tenant_id: uuid.UUID, student_id: uuid.UUID):
    from app.models.education import Guardian

    link = db.execute(
        select(StudentGuardian).where(
            StudentGuardian.tenant_id == tenant_id, StudentGuardian.student_id == student_id, StudentGuardian.is_primary_contact == True  # noqa: E712
        )
    ).scalar_one_or_none()
    if link is None:
        return None
    return db.get(Guardian, link.guardian_id)


def _invoice_outstanding(db: Session, invoice_id: uuid.UUID) -> Decimal:
    allocated = db.execute(
        select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(PaymentAllocation.invoice_id == invoice_id)
    ).scalar_one()
    invoice = db.get(Invoice, invoice_id)
    return invoice.total - allocated


def generate_fee_invoices(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, user_id: uuid.UUID,
    school_class_id: uuid.UUID, fee_structure_item_ids: list[uuid.UUID],
) -> dict:
    schedule_items = [db.get(FeeStructureItem, sid) for sid in fee_structure_item_ids]
    for item, sid in zip(schedule_items, fee_structure_item_ids):
        if item is None or item.tenant_id != tenant_id or item.school_class_id != school_class_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Fee structure item {sid} does not belong to this class.")

    academic_year_ids = {item.academic_year_id for item in schedule_items}
    if len(academic_year_ids) != 1:
        raise AppError(ErrorCode.VALIDATION_ERROR, "All selected fee structure items must belong to the same academic year.")
    academic_year_id = academic_year_ids.pop()

    company = db.get(Company, company_id)
    fy = get_current_financial_year(db, company_id)

    enrolments = db.execute(
        select(StudentEnrolment, Student)
        .join(Student, Student.id == StudentEnrolment.student_id)
        .where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.academic_year_id == academic_year_id, StudentEnrolment.school_class_id == school_class_id)
    ).all()

    already_billed = {
        (row.student_id, row.fee_structure_item_id)
        for row in db.execute(
            select(FeeInvoiceLine.student_id, FeeInvoiceLine.fee_structure_item_id).where(
                FeeInvoiceLine.tenant_id == tenant_id, FeeInvoiceLine.fee_structure_item_id.in_(fee_structure_item_ids)
            )
        )
    }

    created: list[FeeInvoice] = []
    skipped_student_ids: list[uuid.UUID] = []

    for _enrolment, student in enrolments:
        to_bill = [item for item in schedule_items if (student.id, item.id) not in already_billed]
        if not to_bill:
            skipped_student_ids.append(student.id)
            continue

        guardian = _primary_guardian(db, tenant_id, student.id)
        if guardian is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Student {student.first_name} {student.last_name} has no primary guardian to bill fees to.")
        customer = get_or_create_guardian_customer(db, tenant_id=tenant_id, company_id=company_id, guardian=guardian)

        today = date.today()
        place_of_supply = resolve_place_of_supply(site_state=None, customer=customer, company=company)

        subtotal = Decimal("0")
        tax_total = Decimal("0")
        line_specs = []
        for structure_item in to_bill:
            fee_head = db.get(FeeHead, structure_item.fee_head_id)
            fee_item = db.get(Item, fee_head.item_id)
            tax = resolve_tax(document_date=today, place_of_supply_state=place_of_supply, company_state=company.state or "", item=fee_item, taxable_value=structure_item.amount)
            subtotal += structure_item.amount
            tax_total += tax.total_tax
            line_specs.append((fee_item, structure_item, tax))

        rounded_total, round_off = round_invoice_total(subtotal + tax_total)

        number = next_document_number(db, company_id=company_id, branch_id=branch_id, financial_year_id=fy.id, doc_type="INV", default_prefix="INV")
        invoice = Invoice(
            tenant_id=tenant_id, number=number, company_id=company_id, branch_id=branch_id, customer_id=customer.id,
            invoice_date=today, place_of_supply_state=place_of_supply,
            subtotal=subtotal, tax_total=tax_total, round_off=round_off, total=rounded_total, status="posted",
        )
        db.add(invoice)
        db.flush()

        cgst_total = sgst_total = igst_total = Decimal("0")
        for fee_item, structure_item, tax in line_specs:
            db.add(InvoiceItem(
                tenant_id=tenant_id, invoice_id=invoice.id, item_id=fee_item.id, qty=Decimal("1"), uom=fee_item.base_uom,
                rate=structure_item.amount, taxable_value=structure_item.amount,
                cgst_rate=tax.cgst_rate, sgst_rate=tax.sgst_rate, igst_rate=tax.igst_rate,
                cgst_amount=tax.cgst_amount, sgst_amount=tax.sgst_amount, igst_amount=tax.igst_amount,
                line_total=structure_item.amount + tax.total_tax,
            ))
            cgst_total += tax.cgst_amount
            sgst_total += tax.sgst_amount
            igst_total += tax.igst_amount

        _post_invoice_journal(db, tenant_id=tenant_id, invoice=invoice, subtotal=subtotal, cgst_total=cgst_total, sgst_total=sgst_total, igst_total=igst_total, round_off=round_off)

        fee_invoice = FeeInvoice(tenant_id=tenant_id, student_id=student.id, academic_year_id=academic_year_id, invoice_id=invoice.id)
        db.add(fee_invoice)
        db.flush()

        for _fee_item, structure_item, _tax in line_specs:
            db.add(FeeInvoiceLine(tenant_id=tenant_id, fee_invoice_id=fee_invoice.id, student_id=student.id, fee_structure_item_id=structure_item.id))
        db.flush()

        emit_event(
            db, tenant_id=tenant_id, event_type="fee_invoice.generated",
            payload={"id": str(fee_invoice.id), "student_id": str(student.id), "invoice_number": invoice.number, "total": str(invoice.total)},
        )
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="fee_invoice_generated",
            title="Fee invoice generated", message=f"Invoice {invoice.number} (₹{invoice.total}) generated for {student.first_name} {student.last_name}.",
            entity_type="fee_invoice", entity_id=fee_invoice.id, recipient_email=guardian.email,
        )
        created.append(fee_invoice)

    return {"created": [_fee_invoice_out(db, fi) for fi in created], "skipped_student_ids": skipped_student_ids}


def _fee_invoice_due_date(db: Session, fee_invoice_id: uuid.UUID) -> date | None:
    """The earliest due_date among this invoice's own FeeStructureItem
    lines -- real, stored data (set at fee-structure-item creation),
    not a fabricated default. An invoice with multiple lines due on
    different dates is honestly reported as due on the earliest one
    (the one that would make it overdue first)."""
    return db.execute(
        select(func.min(FeeStructureItem.due_date))
        .select_from(FeeInvoiceLine)
        .join(FeeStructureItem, FeeStructureItem.id == FeeInvoiceLine.fee_structure_item_id)
        .where(FeeInvoiceLine.fee_invoice_id == fee_invoice_id)
    ).scalar_one_or_none()


def _fee_invoice_out(db: Session, fee_invoice: FeeInvoice) -> dict:
    invoice = db.get(Invoice, fee_invoice.invoice_id)
    return {
        "id": fee_invoice.id, "student_id": fee_invoice.student_id, "academic_year_id": fee_invoice.academic_year_id,
        "invoice_id": invoice.id, "invoice_number": invoice.number, "invoice_date": invoice.invoice_date,
        "customer_id": invoice.customer_id, "total": invoice.total, "outstanding": _invoice_outstanding(db, invoice.id),
        "due_date": _fee_invoice_due_date(db, fee_invoice.id),
    }


def get_student_fee_summary(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    fee_invoices = db.execute(
        select(FeeInvoice)
        .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.student_id == student_id)
        .order_by(FeeInvoice.created_at.desc())
    ).scalars().all()
    return [_fee_invoice_out(db, fi) for fi in fee_invoices]
