import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    table_name: str
    row_id: uuid.UUID
    action: str
    old_data: dict | None
    new_data: dict | None
    changed_by_user_id: uuid.UUID | None
    occurred_at: datetime

    class Config:
        from_attributes = True
