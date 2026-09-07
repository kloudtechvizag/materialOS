import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class StatementLineOut(BaseModel):
    entry_date: date
    doc_type: str
    doc_number: str
    debit: Decimal
    credit: Decimal
    balance: Decimal


class PortalDocumentOut(BaseModel):
    id: uuid.UUID
    quotation_id: uuid.UUID | None
    sales_order_id: uuid.UUID | None
    file_name: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PaymentIntimationCreate(BaseModel):
    amount: Decimal
    mode: str
    reference_note: str | None = None
    invoice_id: uuid.UUID | None = None
