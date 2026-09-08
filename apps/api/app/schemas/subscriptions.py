import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.billing_plans import PlanOut


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    plan: PlanOut
    status: str
    billing_cycle: str
    current_period_start: datetime
    current_period_end: datetime
    trial_ends_at: datetime | None
    grace_period_ends_at: datetime | None
    cancel_at_period_end: bool
    cancelled_at: datetime | None


class UsageRow(BaseModel):
    limit_key: str
    used: Decimal
    limit: int | None
    enforced: bool


class UpgradeRequest(BaseModel):
    plan_slug: str
    billing_cycle: str = "yearly"


class DowngradeRequest(BaseModel):
    plan_slug: str
    billing_cycle: str = "yearly"


class CancelRequest(BaseModel):
    at_period_end: bool = True


class SubscriptionInvoiceItemOut(BaseModel):
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal

    class Config:
        from_attributes = True


class SubscriptionInvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    status: str
    billing_period_start: date
    billing_period_end: date
    subtotal: Decimal
    discount_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total: Decimal
    currency: str
    issued_at: datetime
    due_at: datetime
    paid_at: datetime | None
    items: list[SubscriptionInvoiceItemOut] = []

    class Config:
        from_attributes = True


class SubscriptionPaymentOut(BaseModel):
    id: uuid.UUID
    subscription_invoice_id: uuid.UUID | None
    provider: str
    provider_order_id: str
    provider_payment_id: str | None
    amount: Decimal
    currency: str
    status: str
    method: str | None
    failure_reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class CheckoutRequest(BaseModel):
    invoice_id: uuid.UUID


class CheckoutOut(BaseModel):
    payment: SubscriptionPaymentOut
    provider: str
    order_id: str
    amount: int
    currency: str
    is_sandbox: bool


class SimulatePaymentRequest(BaseModel):
    succeed: bool = True


class BillingAddressIn(BaseModel):
    legal_name: str
    gstin: str | None = None
    pan: str | None = None
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str
    country: str = "India"
    pincode: str
    email: str
    phone: str | None = None


class BillingAddressOut(BillingAddressIn):
    id: uuid.UUID

    class Config:
        from_attributes = True


class SubscriptionChangeOut(BaseModel):
    """upgrade/downgrade/reactivate all potentially generate a
    SubscriptionInvoice (proration or a fresh charge) that the frontend
    must hand to /billing/checkout to actually collect payment -- a
    plan change is not fully in effect (billing-wise) until that
    invoice is paid, even though plan_id itself already updated."""

    subscription: SubscriptionOut
    invoice: SubscriptionInvoiceOut | None
