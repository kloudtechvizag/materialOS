import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    parameter_schema: list

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str
    parameter_schema: list = []


class ItemOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str
    hsn_code: str | None
    gst_rate: Decimal
    base_uom: str
    brand: str | None
    category_id: uuid.UUID | None
    attributes: dict
    standard_price: Decimal
    min_price: Decimal
    standard_cost: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class ItemCreate(BaseModel):
    sku: str
    name: str
    hsn_code: str | None = None
    gst_rate: Decimal = Decimal("0")
    base_uom: str
    brand: str | None = None
    category_id: uuid.UUID | None = None
    attributes: dict = {}
    standard_price: Decimal = Decimal("0")
    min_price: Decimal = Decimal("0")
    standard_cost: Decimal = Decimal("0")


class ItemUpdate(BaseModel):
    standard_price: Decimal | None = None
    min_price: Decimal | None = None
    standard_cost: Decimal | None = None
    is_active: bool | None = None
    category_id: uuid.UUID | None = None
    brand: str | None = None


class BatchOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    batch_code: str
    manufactured_on: date | None
    expiry_date: date | None
    heat_number: str | None
    cost: Decimal

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    batch_code: str
    manufactured_on: date | None = None
    expiry_date: date | None = None
    heat_number: str | None = None
    cost: Decimal = Decimal("0")
