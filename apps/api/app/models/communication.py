import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class TenantCommunicationConfig(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Stores the tenant's WAHA WhatsApp session state, BYOW options,
    call deflection settings, and future SMS gateway credentials.
    """

    __tablename__ = "tenant_communication_configs"

    waha_session_id: Mapped[str] = mapped_column(String(100), nullable=False, default="default")
    waha_endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    waha_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    session_status: Mapped[str] = mapped_column(String(50), nullable=False, default="STOPPED")
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    push_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_plugged: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    qr_code_raw: Mapped[str | None] = mapped_column(Text, nullable=True)

    # WAHA Apps
    auto_reject_calls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auto_reject_message: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="Thank you for contacting us. We do not accept voice calls on this automated WhatsApp desk. Please message us here.",
    )
    mcp_copilot_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # SMS Gateway (future pluggable)
    sms_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sms_credentials: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    enabled_channels: Mapped[list] = mapped_column(JSONB, nullable=False, default=lambda: ["whatsapp"])
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CommunicationTemplate(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Reusable multi-channel messaging templates with dynamic placeholders
    for invoices, dispatch challans, fees, attendance, and contractor notices.
    """

    __tablename__ = "communication_templates"

    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    whatsapp_body: Mapped[str] = mapped_column(Text, nullable=False)
    sms_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    dlt_template_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sample_variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CommunicationMessage(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Audit log and delivery record of every outbound transactional message
    dispatched over WhatsApp, SMS, or Email.
    """

    __tablename__ = "communication_messages"

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    recipient_phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="whatsapp")
    template_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rendered_text: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|queued|sent|delivered|read|failed
    provider_message_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    provider_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class InboundCommunicationMessage(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Inbound messages received from WhatsApp Webhook or SMS webhooks,
    routed to AI Copilot or CRM inboxes.
    """

    __tablename__ = "inbound_communication_messages"

    sender_phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sender_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="whatsapp")
    message_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    message_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    processed_by_copilot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    copilot_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
