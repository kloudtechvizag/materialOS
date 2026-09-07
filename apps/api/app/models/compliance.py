import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class EInvoice(Base, UUIDPk, TenantMixin, TimestampMixin):
    """D2: IRN generation. See app/einvoice/gateway.py and ADR-007 --
    sandbox-real, live-not-configured until a GSP is actually contracted.
    """

    __tablename__ = "e_invoices"
    __table_args__ = (UniqueConstraint("invoice_id", name="uq_einvoice_invoice"),)

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    irn: Mapped[str] = mapped_column(String(64), nullable=False)
    ack_number: Mapped[str] = mapped_column(String(30), nullable=False)
    ack_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signed_qr_code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="generated")  # generated|cancelled
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)


class EWayBill(Base, UUIDPk, TenantMixin, TimestampMixin):
    """D3: threshold/validity/180-day/cancellation rules live in
    app/ewaybill/service.py, not scattered through the API layer (D4's
    "compliance architecture rule" applied to e-way bills too).
    """

    __tablename__ = "e_way_bills"
    __table_args__ = (UniqueConstraint("invoice_id", name="uq_ewb_invoice"),)

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ewb_number: Mapped[str] = mapped_column(String(20), nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(20), nullable=False)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active|cancelled|expired
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
