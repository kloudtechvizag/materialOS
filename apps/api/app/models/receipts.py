"""ADR-016: the receipt template engine's configurable half.
`ReceiptSettings` is the one place a tenant controls what shows on
*every* printed document (logo, GST breakdown, footer, T&C, UPI QR) --
never a per-module setting duplicated across POS/Invoice/Quotation/etc.
One row per company; branch-level detail (GSTIN, address) is read
live off `Branch` at render time, not duplicated here.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class ReceiptSettings(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "receipt_settings"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    show_logo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_customer_details: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_gst_breakdown: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_sku: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_cashier: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_qr_code: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    footer_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    return_policy: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # A real UPI VPA (e.g. "shop@okhdfcbank") the frontend encodes into
    # an actual scannable upi://pay QR (see components/receipts) -- not
    # a payment gateway integration, just rendering what the admin
    # already accepts payments to, the same way a printed UPI QR
    # sticker at any till works today.
    upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    social_contact_info: Mapped[str | None] = mapped_column(String(300), nullable=True)
    default_paper_width_mm: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
