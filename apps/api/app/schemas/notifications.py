import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    notification_type: str
    title: str
    message: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    is_read: bool
    priority: str
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    unread_count: int


class NotificationRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    trigger_type: str
    threshold_value: Decimal | None
    priority: str
    channels: list[str]
    is_active: bool

    class Config:
        from_attributes = True


class NotificationRuleCreate(BaseModel):
    name: str
    trigger_type: str
    threshold_value: Decimal | None = None
    priority: str = "warning"
    channels: list[str] = ["in_app"]


class NotificationRuleUpdate(BaseModel):
    name: str | None = None
    threshold_value: Decimal | None = None
    priority: str | None = None
    channels: list[str] | None = None
    is_active: bool | None = None


class NotificationDeliveryOut(BaseModel):
    id: uuid.UUID
    notification_id: uuid.UUID
    channel: str
    status: str
    attempt_count: int
    provider_response: str | None
    sent_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
