import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Notification(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §62. In-app is the one real channel (ADR-009/013) --
    push/email/WhatsApp/SMS need real provider credentials no
    environment this runs in has; see NotificationDelivery for how a
    non-in-app channel is represented (a delivery attempt that's
    honestly marked failed/not-configured, never faked as sent).
    Tenant-wide, not per-user (ADR-009): no assignment model exists yet
    to target a specific salesperson/manager.
    """

    __tablename__ = "notifications"

    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # info|success|warning|critical (ADR-013 sec18). Existing rows from
    # before this column existed default to "info" -- never silently
    # promoted to critical by a migration that can't know better.
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="info")


class NotificationRule(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Table-driven, same shape/philosophy as ApprovalRule (dev.md §63,
    ADR-009): a new trigger_type is an additive row plus one call site,
    not a schema change. sec21-22's "visual rule builder" is a simple
    form over these fields in this pass, not a drag-and-drop condition
    editor -- see ADR-013.
    """

    __tablename__ = "notification_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "stock_low" | "invoice_overdue" | "credit_limit_exceeded" | ...
    threshold_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    channels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # ["in_app", "email"] -- see NotificationChannel
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class NotificationDelivery(Base, UUIDPk, TenantMixin, TimestampMixin):
    """sec41-43: one row per (notification, channel) delivery attempt.
    in_app "delivery" is definitionally instant/successful (the
    Notification row itself IS the in-app delivery) -- this table earns
    its keep for channels that can actually fail: retry count, provider
    response, and a dead-letter state (status="failed" after
    max_attempts) that sec43 asks to be inspectable/retryable/
    discardable.
    """

    __tablename__ = "notification_deliveries"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # in_app|email|sms|whatsapp|push
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|sent|failed|dead_letter
    attempt_count: Mapped[int] = mapped_column(nullable=False, default=0)
    provider_response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
