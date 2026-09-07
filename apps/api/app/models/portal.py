import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class PortalDocument(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §58: a customer can "upload PO." Attached to a quotation or
    sales order (whichever the customer was looking at), not a generic
    unattached upload.
    """

    __tablename__ = "portal_documents"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
