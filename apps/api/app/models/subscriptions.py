"""Tenant-scoped side of billing -- a specific tenant's Subscription to
a Plan (app/models/billing_plans.py), its usage against that plan's
limits, its billing address, and the invoices/payments that keep it
paid. All RLS+audit (B9/B12), same as every other tenant table.

Subscription belongs to the tenant, not a company or a user (spec
sec48) -- MaterialOS bills the account that signed up, regardless of
how many companies/branches that tenant later creates.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

# spec sec47. Access rules per state live in services/entitlements.py's
# ACTIVE_LIKE_STATUSES, not scattered across route handlers.
SUBSCRIPTION_STATUSES = [
    "trialing",
    "active",
    "past_due",
    "grace_period",
    "paused",
    "cancelled",
    "expired",
    "suspended",
]


class Subscription(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="trialing")
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False, default="yearly")  # "monthly" | "yearly"
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grace_period_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SubscriptionAddon(Base, UUIDPk, TenantMixin, TimestampMixin):
    """sec21: a customer buys this without changing their core plan.
    Grants either an extra Feature, or extra headroom on one PlanLimit
    (limit_delta), or both are left null and it's pure extra billing
    (e.g. "Premium Support" has no entitlement effect at all)."""

    __tablename__ = "subscription_addons"

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    addon_offering_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("addon_offerings.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    feature_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("features.id", ondelete="SET NULL"), nullable=True)
    limit_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    limit_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class UsageRecord(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Period-based meters only (sec17) -- e.g. invoices_per_month,
    api_calls_per_month. Live-count "quota" limits (users, companies,
    branches) are NOT tracked here -- they're a straight COUNT(*) query
    against the real table at enforcement time (services/usage.py),
    since a deactivated user should immediately free up a seat rather
    than waiting for a period to roll over."""

    __tablename__ = "usage_records"
    __table_args__ = (UniqueConstraint("tenant_id", "subscription_id", "metric_key", "period_start", name="uq_usage_records_period"),)

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_key: Mapped[str] = mapped_column(String(50), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)


class BillingAddress(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "billing_addresses"

    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_line1: Mapped[str] = mapped_column(String(200), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)


class SubscriptionInvoice(Base, UUIDPk, TenantMixin, TimestampMixin):
    """MaterialOS's own bill to the tenant for its subscription --
    distinct from `invoices` (the tenant's own bills to *their*
    customers, Slice 1). Never conflate the two: this table is what a
    MaterialOS tenant owes MaterialOS."""

    __tablename__ = "subscription_invoices"
    __table_args__ = (UniqueConstraint("tenant_id", "invoice_number", name="uq_subscription_invoices_number"),)

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")  # draft|open|paid|failed|void|refunded
    billing_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    billing_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SubscriptionInvoiceItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "subscription_invoice_items"

    subscription_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class SubscriptionPayment(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "subscription_payments"

    subscription_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_invoices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # "sandbox" | "razorpay"
    provider_order_id: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|succeeded|failed|refunded|partially_refunded
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)  # upi|card|netbanking|wallet|other
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_event: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
