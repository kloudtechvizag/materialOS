import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    notification_type: str
    title: str
    message: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    unread_count: int
