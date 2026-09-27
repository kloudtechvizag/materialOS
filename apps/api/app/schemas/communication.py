import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TenantCommunicationConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    waha_session_id: str
    waha_endpoint_url: str | None
    session_status: str
    phone_number: str | None
    push_name: str | None
    battery_level: int | None
    is_plugged: bool | None
    qr_code_raw: str | None
    auto_reject_calls: bool
    auto_reject_message: str
    mcp_copilot_enabled: bool
    sms_provider: str | None
    enabled_channels: list[str]
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TenantCommunicationConfigUpdate(BaseModel):
    waha_endpoint_url: str | None = None
    waha_api_key: str | None = None
    auto_reject_calls: bool | None = None
    auto_reject_message: str | None = None
    mcp_copilot_enabled: bool | None = None
    sms_provider: str | None = None
    sms_credentials: dict[str, Any] | None = None
    enabled_channels: list[str] | None = None


class WhatsAppSessionStartRequest(BaseModel):
    force_restart: bool = False


class WhatsAppSessionStatusOut(BaseModel):
    session_id: str
    status: str  # STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
    phone_number: str | None = None
    push_name: str | None = None
    battery_level: int | None = None
    is_plugged: bool | None = None
    qr_available: bool = False
    qr_code_raw: str | None = None
    detail: str = ""


class WhatsAppQrCodeOut(BaseModel):
    session_id: str
    qr_raw: str | None = None
    qr_data_url: str | None = None
    expires_in_seconds: int = 45


class CommunicationTemplateCreate(BaseModel):
    slug: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    category: str = Field("general", max_length=50)
    whatsapp_body: str
    sms_body: str | None = None
    dlt_template_id: str | None = None
    sample_variables: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class CommunicationTemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    whatsapp_body: str | None = None
    sms_body: str | None = None
    dlt_template_id: str | None = None
    sample_variables: dict[str, Any] | None = None
    is_active: bool | None = None


class CommunicationTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    slug: str
    name: str
    category: str
    whatsapp_body: str
    sms_body: str | None
    dlt_template_id: str | None
    sample_variables: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SendWhatsAppMessageRequest(BaseModel):
    recipient_phone: str = Field(..., description="Phone number with country code, e.g. +919848012345")
    recipient_name: str | None = None
    template_slug: str | None = None
    message_text: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)
    media_url: str | None = None
    media_filename: str | None = None
    entity_type: str | None = None
    entity_id: uuid.UUID | None = None


class CommunicationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    entity_type: str | None
    entity_id: uuid.UUID | None
    recipient_name: str | None
    recipient_phone: str
    channel: str
    template_slug: str | None
    rendered_text: str
    media_url: str | None
    media_filename: str | None
    status: str
    provider_message_id: str | None
    sent_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    error_message: str | None
    retry_count: int
    created_at: datetime
