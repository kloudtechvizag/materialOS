"""ADR-014: generates MaterialOS's own invoices to a tenant for their
subscription (spec sec33-35). Deliberately NOT posted into the
tenant's own chart of accounts/journal -- that would require treating
MaterialOS's own SaaS fee as one more of the tenant's business
transactions, a real but separate integration this pass doesn't build
(see ADR-014's deferred list). GST here is a fixed platform rate
(software services), not `resolve_tax()` (app/tax/resolve.py), which
is keyed off an Item's own gst_rate and doesn't apply to MaterialOS's
own billing.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.subscriptions import Subscription, SubscriptionInvoice, SubscriptionInvoiceItem
from app.services.money import round_line_tax

DUE_IN_DAYS = 7


def calculate_platform_gst(*, taxable_value: Decimal, tenant_state: str | None) -> tuple[Decimal, Decimal, Decimal]:
    """Returns (cgst, sgst, igst). No tenant_state on file yet (no
    BillingAddress saved) is treated as interstate/IGST -- the safer
    default (MaterialOS's own state is not assumed to match an unknown
    customer's)."""
    is_intrastate = bool(tenant_state) and tenant_state.strip().lower() == settings.platform_state.strip().lower()
    rate = settings.platform_gst_rate
    if is_intrastate:
        half = round_line_tax(taxable_value * (rate / 2) / 100)
        return half, half, Decimal("0")
    full = round_line_tax(taxable_value * rate / 100)
    return Decimal("0"), Decimal("0"), full


def _next_invoice_number(db: Session, tenant_id: uuid.UUID) -> str:
    count = db.execute(
        select(func.count()).select_from(SubscriptionInvoice).where(SubscriptionInvoice.tenant_id == tenant_id)
    ).scalar_one()
    return f"SUB-INV-{count + 1:06d}"


def generate_invoice(
    db: Session, *, subscription: Subscription, tenant_id: uuid.UUID, tenant_state: str | None,
    line_items: list[tuple[str, Decimal, Decimal]],  # (description, quantity, unit_price)
    billing_period_start: date, billing_period_end: date, discount_amount: Decimal = Decimal("0"),
) -> SubscriptionInvoice:
    subtotal = sum((qty * price for _, qty, price in line_items), Decimal("0")).quantize(Decimal("0.01"))
    taxable_value = subtotal - discount_amount
    cgst, sgst, igst = calculate_platform_gst(taxable_value=taxable_value, tenant_state=tenant_state)
    total = (taxable_value + cgst + sgst + igst).quantize(Decimal("0.01"))

    now = datetime.now(timezone.utc)
    invoice = SubscriptionInvoice(
        tenant_id=tenant_id, subscription_id=subscription.id, invoice_number=_next_invoice_number(db, tenant_id),
        status="open", billing_period_start=billing_period_start, billing_period_end=billing_period_end,
        subtotal=subtotal, discount_amount=discount_amount, cgst_amount=cgst, sgst_amount=sgst, igst_amount=igst,
        total=total, currency="INR", issued_at=now, due_at=now + timedelta(days=DUE_IN_DAYS),
    )
    db.add(invoice)
    db.flush()

    for description, qty, unit_price in line_items:
        db.add(SubscriptionInvoiceItem(
            tenant_id=tenant_id, subscription_invoice_id=invoice.id, description=description,
            quantity=qty, unit_price=unit_price, amount=(qty * unit_price).quantize(Decimal("0.01")),
        ))
    db.flush()
    return invoice
