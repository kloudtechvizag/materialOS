import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.einvoice.gateway import get_gateway
from app.errors import AppError, ErrorCode
from app.models.compliance import EInvoice
from app.models.sales import Invoice
from app.models.tenant import Company


def generate_irn(db: Session, *, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> EInvoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "Invoice not found.", status_code=404)

    company = db.get(Company, invoice.company_id)
    if not company.e_invoice_enabled:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "E-invoicing is not enabled for this company. An admin must turn it on once AATO crosses ₹5 crore (D2).",
        )

    existing = db.execute(select(EInvoice).where(EInvoice.invoice_id == invoice_id)).scalar_one_or_none()
    if existing is not None and existing.status == "generated":
        raise AppError(ErrorCode.CONFLICT, "An active IRN already exists for this invoice.", status_code=409)

    gateway = get_gateway()
    result = gateway.generate_irn(
        invoice_number=invoice.number, invoice_date=invoice.invoice_date.isoformat(),
        seller_gstin=company.gstin or "", total=str(invoice.total),
    )

    e_invoice = EInvoice(
        tenant_id=tenant_id, invoice_id=invoice_id, irn=result.irn, ack_number=result.ack_number,
        ack_date=result.ack_date, signed_qr_code=result.signed_qr_code, status="generated",
    )
    db.add(e_invoice)
    db.flush()
    return e_invoice


def cancel_irn(db: Session, *, e_invoice_id: uuid.UUID, reason: str) -> EInvoice:
    e_invoice = db.get(EInvoice, e_invoice_id)
    if e_invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "E-invoice not found.", status_code=404)
    if e_invoice.status != "generated":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only an active IRN can be cancelled.")

    gateway = get_gateway()
    gateway.cancel_irn(irn=e_invoice.irn, reason=reason)

    e_invoice.status = "cancelled"
    e_invoice.cancelled_at = datetime.now(timezone.utc)
    e_invoice.cancel_reason = reason
    db.flush()
    return e_invoice
