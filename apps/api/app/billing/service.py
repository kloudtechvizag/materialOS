"""ADR-014 (spec sec31-32, sec61): the checkout -> gateway -> webhook ->
activation pipeline. `checkout()` only ever creates a `pending` payment
row; nothing here ever marks a payment (or the subscription it pays
for) as succeeded except `handle_webhook()` -- including in sandbox
mode, where the dev-only `simulate_payment_result()` still goes through
the same `handle_webhook()` every real gateway callback would hit,
rather than a separate "just trust the frontend" shortcut.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.billing.gateway import OrderResult, get_payment_provider, is_sandbox
from app.errors import AppError, ErrorCode
from app.models.subscriptions import Subscription, SubscriptionInvoice, SubscriptionPayment
from app.services.notification_rules import fire_trigger
from app.services.subscriptions import period_end


def checkout(db: Session, *, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> tuple[SubscriptionPayment, OrderResult]:
    invoice = db.get(SubscriptionInvoice, invoice_id)
    if invoice is None or invoice.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Subscription invoice not found.", status_code=404)
    if invoice.status == "paid":
        raise AppError(ErrorCode.CONFLICT, "This invoice is already paid.", status_code=409)

    provider = get_payment_provider()
    order = provider.create_order(amount_rupees=invoice.total, currency=invoice.currency, receipt=f"sub-inv-{invoice.id}")

    payment = SubscriptionPayment(
        tenant_id=tenant_id, subscription_invoice_id=invoice.id,
        provider="sandbox" if is_sandbox() else "razorpay", provider_order_id=order.order_id,
        amount=invoice.total, currency=invoice.currency, status="pending",
    )
    db.add(payment)
    db.flush()
    return payment, order


def handle_webhook(db: Session, *, event: dict) -> SubscriptionPayment:
    """Idempotent: replays of the same event (a real gateway retries
    until it gets a 2xx, spec sec32) are a no-op once a payment has
    already reached a terminal status."""
    payment = db.execute(
        select(SubscriptionPayment).where(SubscriptionPayment.provider_order_id == event["order_id"])
    ).scalar_one_or_none()
    if payment is None:
        raise AppError(ErrorCode.NOT_FOUND, "No payment found for this order.", status_code=404)
    if payment.status in ("succeeded", "failed"):
        return payment  # already processed -- idempotent no-op

    payment.raw_event = event
    now = datetime.now(timezone.utc)

    if event["event"] == "payment.success":
        payment.status = "succeeded"
        payment.provider_payment_id = event.get("payment_id")
        payment.method = event.get("method")

        if payment.subscription_invoice_id:
            invoice = db.get(SubscriptionInvoice, payment.subscription_invoice_id)
            invoice.status = "paid"
            invoice.paid_at = now

            subscription = db.get(Subscription, invoice.subscription_id)
            was_lapsed = subscription.status in ("cancelled", "expired", "suspended")
            subscription.status = "active"
            subscription.cancel_at_period_end = False
            subscription.cancelled_at = None
            subscription.grace_period_ends_at = None
            if was_lapsed or subscription.current_period_end < now:
                subscription.current_period_start = now
                subscription.current_period_end = period_end(subscription.billing_cycle, now)
            fire_trigger(
                db, tenant_id=payment.tenant_id, trigger_type="subscription_renewed",
                title="Payment successful", message=f"Your payment of ₹{payment.amount} was received. Your subscription is active.",
            )
    elif event["event"] == "payment.failed":
        payment.status = "failed"
        payment.failure_reason = event.get("failure_reason", "Payment failed")
        fire_trigger(
            db, tenant_id=payment.tenant_id, trigger_type="payment_failed",
            title="Payment failed", message=payment.failure_reason,
        )
    else:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unrecognised event type: {event.get('event')!r}")

    db.flush()
    return payment


def simulate_payment_result(db: Session, *, tenant_id: uuid.UUID, payment_id: uuid.UUID, succeed: bool) -> SubscriptionPayment:
    """Sandbox-only dev helper standing in for the gateway's own async
    callback (spec sec31's "Gateway -> Payment Success -> Webhook").
    Refuses outright if a live provider is configured -- this must
    never exist as a way to fake a real payment."""
    if not is_sandbox():
        raise AppError(ErrorCode.VALIDATION_ERROR, "Payment simulation is only available with the sandbox provider.")

    payment = db.get(SubscriptionPayment, payment_id)
    if payment is None or payment.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payment not found.", status_code=404)

    event = {
        "event": "payment.success" if succeed else "payment.failed",
        "tenant_id": str(tenant_id),
        "order_id": payment.provider_order_id,
        "payment_id": f"SANDBOX_pay_{uuid.uuid4().hex[:16]}",
        "method": "upi",
        "failure_reason": None if succeed else "Simulated failure (sandbox)",
    }
    return handle_webhook(db, event=event)
