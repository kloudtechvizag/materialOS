import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TransferLineInput(BaseModel):
    item_id: uuid.UUID
    qty: Decimal


class TransferCreate(BaseModel):
    from_warehouse_id: uuid.UUID
    to_warehouse_id: uuid.UUID
    lines: list[TransferLineInput]


class TransferItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal

    class Config:
        from_attributes = True


class TransferOut(BaseModel):
    id: uuid.UUID
    number: str
    from_warehouse_id: uuid.UUID
    to_warehouse_id: uuid.UUID
    transfer_date: date
    status: str
    items: list[TransferItemOut] = []

    class Config:
        from_attributes = True


class StockCountCreate(BaseModel):
    warehouse_id: uuid.UUID
    item_ids: list[uuid.UUID]


class StockCountItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    system_qty: Decimal
    counted_qty: Decimal
    variance: Decimal

    class Config:
        from_attributes = True


class StockCountOut(BaseModel):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    count_date: date
    status: str
    items: list[StockCountItemOut] = []

    class Config:
        from_attributes = True


class StockCountSubmit(BaseModel):
    counted_quantities: dict[str, Decimal]  # item_id (str) -> counted qty


class ReturnLineInput(BaseModel):
    invoice_item_id: uuid.UUID
    qty: Decimal


class SalesReturnCreate(BaseModel):
    invoice_id: uuid.UUID
    warehouse_id: uuid.UUID
    reason: str | None = None
    lines: list[ReturnLineInput]


class SalesReturnOut(BaseModel):
    id: uuid.UUID
    number: str
    invoice_id: uuid.UUID
    return_date: date
    reason: str | None
    total: Decimal

    class Config:
        from_attributes = True
