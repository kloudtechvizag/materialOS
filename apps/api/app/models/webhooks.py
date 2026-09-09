import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class WebhookSubscription(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Real gap for §57/§62's event/integration architecture: no way
    for a tenant to receive a callback when something happens in their
    own data. `event_types` is a plain JSONB array of dotted event
    names (e.g. "sales_order.created") -- checked at delivery time
    against services/webhooks.py's own fixed set of real, emitted
    events, not an open-ended free-text scheme.
    """

    __tablename__ = "webhook_subscriptions"

    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    event_types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    secret: Mapped[str] = mapped_column(String(200), nullable=False)  # HMAC-SHA256 signs every delivered payload
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class WebhookDelivery(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Same retry/dead-letter shape as NotificationDelivery (ADR-013) --
    a webhook endpoint being down is exactly the same "don't retry
    forever" problem as an email provider hiccup.
    """

    __tablename__ = "webhook_deliveries"

    webhook_subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | sent | dead_letter
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider_response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
