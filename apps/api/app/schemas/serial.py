import uuid
from datetime import date

from pydantic import BaseModel


class SerialUnitOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    serial_number: str
    status: str
    warehouse_id: uuid.UUID | None
    purchase_bill_item_id: uuid.UUID | None
    invoice_item_id: uuid.UUID | None
    warranty_expiry: date | None
    notes: str | None

    class Config:
        from_attributes = True


class SerialUnitCreate(BaseModel):
    item_id: uuid.UUID
    serial_number: str
    warehouse_id: uuid.UUID | None = None
    warranty_expiry: date | None = None
    notes: str | None = None


class SerialUnitUpdate(BaseModel):
    status: str | None = None
    warehouse_id: uuid.UUID | None = None
    invoice_item_id: uuid.UUID | None = None
    warranty_expiry: date | None = None
    notes: str | None = None


class RmaRequestOut(BaseModel):
    id: uuid.UUID
    number: str
    serial_unit_id: uuid.UUID
    customer_id: uuid.UUID
    reason: str
    status: str
    resolution: str | None
    resolution_notes: str | None
    requested_date: date
    resolved_date: date | None

    class Config:
        from_attributes = True


class RmaRequestCreate(BaseModel):
    serial_unit_id: uuid.UUID
    customer_id: uuid.UUID
    reason: str


class RmaRequestUpdate(BaseModel):
    status: str | None = None
    resolution: str | None = None
    resolution_notes: str | None = None
