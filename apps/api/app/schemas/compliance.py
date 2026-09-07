import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class EInvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    irn: str
    ack_number: str
    ack_date: datetime
    signed_qr_code: str
    status: str

    class Config:
        from_attributes = True


class EInvoiceCancelRequest(BaseModel):
    reason: str


class EWayBillCreate(BaseModel):
    vehicle_number: str
    distance_km: Decimal


class EWayBillOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    ewb_number: str
    vehicle_number: str
    distance_km: Decimal
    generated_at: datetime
    valid_until: datetime
    status: str

    class Config:
        from_attributes = True


class EWayBillCancelRequest(BaseModel):
    reason: str
