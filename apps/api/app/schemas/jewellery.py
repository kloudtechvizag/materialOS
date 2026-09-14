import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class MetalRateCreate(BaseModel):
    metal: str
    purity: str
    rate_per_gram: Decimal
    effective_date: date


class MetalRateOut(BaseModel):
    id: uuid.UUID
    metal: str
    purity: str
    rate_per_gram: Decimal
    effective_date: date

    class Config:
        from_attributes = True
