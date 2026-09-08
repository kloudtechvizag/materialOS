import uuid
from datetime import datetime

from pydantic import BaseModel


class BackupOut(BaseModel):
    id: uuid.UUID
    status: str
    checksum: str | None
    size_bytes: int | None
    table_counts: dict
    started_at: datetime | None
    completed_at: datetime | None
    verified_at: datetime | None
    restored_at: datetime | None
    restored_by_user_id: uuid.UUID | None
    created_by_user_id: uuid.UUID | None
    error_message: str | None

    class Config:
        from_attributes = True


class RestoreRequest(BaseModel):
    confirm: bool = False
