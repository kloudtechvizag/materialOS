import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class LineInput(BaseModel):
    item_id: uuid.UUID
    qty: Decimal
    uom: str | None = None


class QuotationCreate(BaseModel):
    customer_id: uuid.UUID
    project_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    valid_until: date | None = None
    lines: list[LineInput]


class QuotationItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    uom: str
    rate: Decimal
    cost: Decimal
    gst_rate: Decimal
    line_subtotal: Decimal
    line_tax: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class QuotationOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID
    project_id: uuid.UUID | None
    site_id: uuid.UUID | None
    status: str
    quote_date: date
    valid_until: date | None
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    total_cost: Decimal
    items: list[QuotationItemOut] = []

    class Config:
        from_attributes = True


class ConvertToOrderRequest(BaseModel):
    warehouse_id: uuid.UUID


class SalesOrderItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    uom: str
    rate: Decimal
    line_subtotal: Decimal
    line_tax: Decimal
    line_total: Decimal
    qty_dispatched: Decimal

    class Config:
        from_attributes = True


class SalesOrderOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID
    project_id: uuid.UUID | None
    warehouse_id: uuid.UUID
    status: str
    order_date: date
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    items: list[SalesOrderItemOut] = []

    class Config:
        from_attributes = True


class DeliveryChallanOut(BaseModel):
    id: uuid.UUID
    number: str
    sales_order_id: uuid.UUID
    dispatch_date: date
    status: str
    trip_id: uuid.UUID | None = None

    class Config:
        from_attributes = True

    class Config:
        from_attributes = True


class InvoiceItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    uom: str
    rate: Decimal
    taxable_value: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID
    invoice_date: date
    place_of_supply_state: str
    subtotal: Decimal
    tax_total: Decimal
    round_off: Decimal
    total: Decimal
    status: str
    items: list[InvoiceItemOut] = []

    class Config:
        from_attributes = True


class ReceiptCreate(BaseModel):
    customer_id: uuid.UUID
    amount: Decimal
    mode: str
    reference_note: str | None = None
    invoice_id: uuid.UUID | None = None


class ReceiptOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID
    receipt_date: date
    amount: Decimal
    mode: str

    class Config:
        from_attributes = True
