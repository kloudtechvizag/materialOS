import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class AgeingLineOut(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: str
    invoice_date: date
    due_date: date
    amount_due: Decimal
    days_overdue: int
    bucket: str
    reason: str


class DsoOut(BaseModel):
    period_days: int
    dso: Decimal | None
