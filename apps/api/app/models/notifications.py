import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Notification(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §62. In-app only (see ADR-009) -- push/email/WhatsApp/SMS
    channels need real provider credentials this environment doesn't
    have. Tenant-wide, not per-user (ADR-009): no assignment model
    exists yet to target a specific salesperson/manager.
    """

    __tablename__ = "notifications"

    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
