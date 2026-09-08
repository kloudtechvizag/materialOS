"""Printing Press / Digital Color Lab profile (ADR-011). The core
directive here is explicit: this is a Customer -> Job -> Artwork ->
Prepress -> Production -> Finishing -> QC -> Delivery -> Invoice ->
Profitability business, not products-in-a-cart. PrintJob is genuinely
new (no existing entity models "a job moving through production
stages"), but everything around it is deliberately reused rather than
re-modeled: paper/media/ink/consumables are Items (Category +
Item.attributes JSONB already handles GSM/width/finish per ADR-003 --
building a parallel print_media table would be exactly the "hundreds of
nullable columns" / duplicate-universal-table anti-pattern the original
multi-industry brief warns against), projects reuse Project/Site
(sec61's "reuse the existing project engine" is already true for free),
outsourcing reuses Supplier, and billing reuses Invoice/InvoiceItem/the
journal -- see services/printing.py.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)
QTY = Numeric(18, 4)

# Kanban/production-board order (sec22). Statuses beyond this list
# (invoiced, cancelled) exist but aren't board columns.
JOB_STATUSES = [
    "draft", "quoted", "approved", "artwork_pending", "prepress",
    "ready_to_print", "printing", "finishing", "qc", "rework", "packing",
    "ready_for_pickup", "dispatched", "invoiced", "cancelled",
]


class PrintMachine(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "print_machines"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    machine_type: Mapped[str] = mapped_column(String(100), nullable=False)  # free text, sec10 -- configurable, not an enum
    capacity_per_hour: Mapped[Decimal | None] = mapped_column(QTY, nullable=True)
    capacity_unit: Mapped[str | None] = mapped_column(String(30), nullable=True)  # "sheets" | "sq_ft" | "meters" | ...
    hourly_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    # available|running|idle|maintenance|breakdown|offline (sec12)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PrintJob(Base, UUIDPk, TenantMixin, TimestampMixin):
    """The central entity (sec3). specification is free-form JSONB
    (size, paper, sides, color mode, ...) -- same "advisory, not a
    hard schema" choice ADR-003 made for Item.attributes, for the same
    reason: job specs vary too much by print process (sec4) to
    normalize into columns without guessing wrong for half of them.
    """

    __tablename__ = "print_jobs"
    __table_args__ = ()

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    # Optional catalogue link -- a job's product ("Business Cards -
    # Digital Color") can be a real priced Item for GST/HSN/reporting;
    # if absent, invoicing lazily creates a generic one (see
    # services/printing.py::get_or_create_print_charges_item, mirroring
    # services/pos.py's walk-in-customer pattern).
    item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)  # "Business Cards", "Flyers", ... -- configurable, sec4
    specification: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    quantity: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=1)

    machine_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("print_machines.id", ondelete="SET NULL"), nullable=True, index=True)

    # Primary media consumed (paper/vinyl/canvas/...), if tracked as
    # stock -- an ordinary Item, deducted via apply_ledger_movement at
    # completion exactly like POS deducts sale items (B3).
    media_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    media_qty: Mapped[Decimal | None] = mapped_column(QTY, nullable=True)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")  # normal|high|urgent|express
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pickup|courier|delivery
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_outsourced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    outsource_vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    outsource_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)

    # Job costing (sec18/44) -- entered by staff, not derived from a
    # sheet/N-up calculator (sec16/17 -- see ADR-011 for why that's
    # deferred rather than guessed at).
    material_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    printing_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    finishing_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    labor_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    wastage_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    finishing_ops: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # ["Matt Lamination", "Cutting", ...]

    quoted_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)

    qc_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pass|pass_with_notes|rework|reject
    qc_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rework_of_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("print_jobs.id", ondelete="SET NULL"), nullable=True)

    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class PrintJobArtwork(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Versioned + approval-gated (sec13/14). Production must not be
    startable on a job whose latest artwork isn't approved -- enforced
    in services/printing.py's status transition, not just documented
    here, so "prevent accidental use of an older version" is a real
    guard, not a UI convention."""

    __tablename__ = "print_job_artwork"

    print_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("print_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # no FK -- ApprovalRequest.requested_by_user_id sets this precedent
    # draft|submitted|customer_review|changes_requested|approved|rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    comments: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
