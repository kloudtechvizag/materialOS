import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class VisitCreate(BaseModel):
    customer_id: uuid.UUID
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    purpose: str | None = None
    notes: str | None = None


class VisitOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    salesperson_user_id: uuid.UUID
    checked_in_at: datetime
    purpose: str | None
    notes: str | None

    class Config:
        from_attributes = True
