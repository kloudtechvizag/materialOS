"""Fee Management (spec sec16/17) -- deliberately reuses the core
accounting stack (Customer, Item, Invoice, Receipt, PaymentAllocation)
rather than a parallel fee ledger. A school fee is not architecturally
different from any other billable, non-stock service this codebase
already invoices (see services/printing.py's `complete_job_and_invoice`
for the established precedent) -- it needs GST-correct invoicing,
receivables ageing, and payment collection, all of which the core
sales/accounting modules already provide for free once a FeeHead has a
real backing Item and a guardian has a real backing Customer.

Deliberately NOT built in this pass (named, not faked): scholarships/
fee concessions as a first-class discount, and late-fee penalty
calculation.

**Online payment gateway (ADR-042)**: `FeePayment` mirrors
`SubscriptionPayment` (models/subscriptions.py, ADR-014) field-for-
field -- the exact same checkout -> gateway -> webhook -> real Receipt
pipeline, reusing `app.billing.gateway`'s `PaymentProvider` abstraction
(a real, deterministic sandbox and a live Razorpay-shaped provider
that raises until real credentials are configured) rather than
inventing a second payment pattern. A guardian-initiated "pay my fees"
checkout (services/fee_payment.py) is the real, parent-facing flow;
`handle_webhook` is the only place a payment is ever marked succeeded,
same discipline as billing/service.py's own docstring.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

FEE_AMOUNT = Numeric(12, 2)


class FeeHead(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A billable fee type ("Tuition Fee", "Transport Fee"). Backed by
    a real, dedicated Item (item_id) so every fee invoice line runs
    through the exact same GST/tax-resolution and journal-posting code
    every other invoice in this codebase does -- not a fee-specific
    reimplementation of tax math."""

    __tablename__ = "fee_heads"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_fee_heads_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)


class FeeStructureItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    """What a given class is charged for a given fee head, for a given
    academic year -- the per-class fee schedule. Multiple fee heads
    (e.g. one per term) compose a school's full-year fee plan; there is
    no separate "installment" concept beyond defining more fee heads."""

    __tablename__ = "fee_structure_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "academic_year_id", "school_class_id", "fee_head_id", name="uq_fee_structure_items"),
    )

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    school_class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    fee_head_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_heads.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(FEE_AMOUNT, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)


class FeeInvoice(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Bridges a real core Invoice back to the Student it was raised
    for -- Invoice itself only knows about Customer (the guardian),
    never the student directly."""

    __tablename__ = "fee_invoices"
    __table_args__ = (UniqueConstraint("tenant_id", "invoice_id", name="uq_fee_invoices_invoice"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )


class FeeInvoiceLine(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One (student, fee_structure_item) billed pair. The uniqueness
    constraint is the real guarantee here: a fee-invoice generation run
    can be safely re-triggered (e.g. for students added after the
    first run) without ever double-billing a student for the same fee
    line -- generate_fee_invoices skips any pair already present."""

    __tablename__ = "fee_invoice_lines"
    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "fee_structure_item_id", name="uq_fee_invoice_lines_student_item"),
    )

    fee_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fee_structure_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_structure_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )


class FeePayment(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Field-for-field mirror of SubscriptionPayment (models/subscriptions.py,
    ADR-014) -- see this module's own docstring."""

    __tablename__ = "fee_payments"

    fee_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # "sandbox" | "razorpay"
    provider_order_id: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|succeeded|failed
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)  # upi|card|netbanking|wallet|other
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_event: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Set once the webhook actually records the real Receipt -- the
    # payment row and the Receipt are two real, separate facts (a
    # gateway event and an accounting entry), linked but not merged.
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True
    )
