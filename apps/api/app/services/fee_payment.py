"""ADR-042: guardian-initiated fee payment -- the same checkout ->
gateway -> webhook -> real Receipt pipeline as billing/service.py
(ADR-014), reusing `app.billing.gateway`'s PaymentProvider abstraction
rather than a second payment pattern. `handle_webhook` is the only
place a FeePayment is ever marked succeeded, including in sandbox mode
(`simulate_payment_result` still goes through it) -- same discipline
billing/service.py's own docstring establishes.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.gateway import OrderResult, get_payment_provider, is_sandbox
from app.errors import AppError, ErrorCode
from app.models.fees import FeeInvoice, FeePayment
from app.models.sales import Invoice
from app.services.fees import _invoice_outstanding, _primary_guardian, get_or_create_guardian_customer
from app.services.guardian_portal import _owned_student
from app.services.numbering import get_current_financial_year
from app.services.receipts import record_receipt


def checkout(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID, fee_invoice_id: uuid.UUID) -> tuple[FeePayment, OrderResult]:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)

    fee_invoice = db.get(FeeInvoice, fee_invoice_id)
    if fee_invoice is None or fee_invoice.tenant_id != tenant_id or fee_invoice.student_id != student_id:
        raise AppError(ErrorCode.NOT_FOUND, "Fee invoice not found for this child.", status_code=404)

    outstanding = _invoice_outstanding(db, fee_invoice.invoice_id)
    if outstanding <= 0:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This invoice has no outstanding balance to pay.")

    invoice = db.get(Invoice, fee_invoice.invoice_id)
    provider = get_payment_provider()
    order = provider.create_order(amount_rupees=outstanding, currency="INR", receipt=f"fee-inv-{fee_invoice.id}")

    payment = FeePayment(
        tenant_id=tenant_id, fee_invoice_id=fee_invoice.id,
        provider="sandbox" if is_sandbox() else "razorpay", provider_order_id=order.order_id,
        amount=outstanding, currency="INR", status="pending",
    )
    db.add(payment)
    db.flush()
    return payment, order


def handle_webhook(db: Session, *, event: dict) -> FeePayment:
    """Idempotent: a replayed event on an already-terminal payment is a
    no-op, same reasoning as billing/service.py's own handle_webhook."""
    payment = db.execute(select(FeePayment).where(FeePayment.provider_order_id == event["order_id"])).scalar_one_or_none()
    if payment is None:
        raise AppError(ErrorCode.NOT_FOUND, "No fee payment found for this order.", status_code=404)
    if payment.status in ("succeeded", "failed"):
        return payment

    payment.raw_event = event

    if event["event"] == "payment.success":
        payment.status = "succeeded"
        payment.provider_payment_id = event.get("payment_id")
        payment.method = event.get("method")

        fee_invoice = db.get(FeeInvoice, payment.fee_invoice_id)
        invoice = db.get(Invoice, fee_invoice.invoice_id)
        guardian = _primary_guardian(db, payment.tenant_id, fee_invoice.student_id)
        customer = get_or_create_guardian_customer(db, tenant_id=payment.tenant_id, company_id=invoice.company_id, guardian=guardian)
        fy = get_current_financial_year(db, invoice.company_id)

        receipt = record_receipt(
            db, tenant_id=payment.tenant_id, company_id=invoice.company_id, branch_id=invoice.branch_id, financial_year_id=fy.id,
            customer_id=customer.id, amount=payment.amount, mode=payment.method or "upi",
            reference_note=f"Online payment (order {payment.provider_order_id})", invoice_id=invoice.id,
        )
        payment.receipt_id = receipt.id
    elif event["event"] == "payment.failed":
        payment.status = "failed"
        payment.failure_reason = event.get("failure_reason", "Payment failed")
    else:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unrecognised event type: {event.get('event')!r}")

    db.flush()
    return payment


def simulate_payment_result(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, payment_id: uuid.UUID, succeed: bool) -> FeePayment:
    """Sandbox-only dev/demo helper standing in for the gateway's real
    async callback -- refuses outright if a live provider is
    configured, same guard as billing/service.py's own version."""
    if not is_sandbox():
        raise AppError(ErrorCode.VALIDATION_ERROR, "Payment simulation is only available with the sandbox provider.")

    payment = db.get(FeePayment, payment_id)
    if payment is None or payment.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payment not found.", status_code=404)
    fee_invoice = db.get(FeeInvoice, payment.fee_invoice_id)
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=fee_invoice.student_id)

    event = {
        "event": "payment.success" if succeed else "payment.failed",
        "tenant_id": str(tenant_id),
        "order_id": payment.provider_order_id,
        "payment_id": f"SANDBOX_pay_{uuid.uuid4().hex[:16]}",
        "method": "upi",
        "failure_reason": None if succeed else "Simulated failure (sandbox)",
    }
    return handle_webhook(db, event=event)
