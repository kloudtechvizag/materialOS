import uuid
from datetime import datetime

from pydantic import BaseModel


class WebhookSubscriptionOut(BaseModel):
    id: uuid.UUID
    url: str
    event_types: list[str]
    description: str | None
    is_active: bool

    class Config:
        from_attributes = True


class WebhookSubscriptionCreated(WebhookSubscriptionOut):
    secret: str  # only ever returned once, at creation time


class WebhookSubscriptionCreate(BaseModel):
    url: str
    event_types: list[str]
    description: str | None = None


class WebhookSubscriptionUpdate(BaseModel):
    url: str | None = None
    event_types: list[str] | None = None
    description: str | None = None
    is_active: bool | None = None


class WebhookDeliveryOut(BaseModel):
    id: uuid.UUID
    webhook_subscription_id: uuid.UUID
    event_type: str
    status: str
    attempt_count: int
    response_status: int | None
    provider_response: str | None
    sent_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookEventCatalogEntry(BaseModel):
    event_type: str
    description: str
