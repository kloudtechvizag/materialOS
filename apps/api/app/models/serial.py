import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class SerialUnit(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Real gap for §8's Electronics/Mobile/Computer Hardware domain
    logic: individually-tracked units (serial/IMEI) with warranty and
    an RMA history. Deliberately additive, not a rewrite of the
    quantity-based stock ledger (StockLedger/StockBalance) every other
    module already depends on -- a serial number is captured alongside
    a goods receipt or invoice line, not required by it. An item that
    never registers a serial behaves exactly as it does today.
    """

    __tablename__ = "serial_units"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # in_stock -> sold -> (returned | under_repair -> in_stock) ; or scrapped
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_stock")
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    purchase_bill_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_bill_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    invoice_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoice_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    warranty_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class RmaRequest(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Real RMA lifecycle against one serial unit. requested_date /
    resolved_date and status are what a service counter actually needs
    -- not a generic "ticket" model borrowed from a support desk.
    """

    __tablename__ = "rma_requests"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    serial_unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("serial_units.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    # requested -> approved -> in_repair -> resolved ; or rejected at any point before resolved
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")
    resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)  # repaired | replaced | refunded | rejected
    resolution_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    requested_date: Mapped[date] = mapped_column(Date, nullable=False)
    resolved_date: Mapped[date | None] = mapped_column(Date, nullable=True)
