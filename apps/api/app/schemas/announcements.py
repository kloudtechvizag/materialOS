import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    target_type: str
    target_branch_id: uuid.UUID | None
    target_school_class_id: uuid.UUID | None
    target_section_id: uuid.UUID | None
    published_by_user_id: uuid.UUID | None
    expires_at: date | None
    created_at: datetime

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    target_type: str
    target_branch_id: uuid.UUID | None = None
    target_school_class_id: uuid.UUID | None = None
    target_section_id: uuid.UUID | None = None
    expires_at: date | None = None


class GuardianAnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    target_type: str
    created_at: datetime
    is_read: bool
