import uuid
from decimal import Decimal

from pydantic import BaseModel


class WalkInSaleLineIn(BaseModel):
    item_id: uuid.UUID
    qty: Decimal
    uom: str


class WalkInSaleCreate(BaseModel):
    warehouse_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    items: list[WalkInSaleLineIn]
    cash_amount: Decimal = Decimal("0")
    upi_amount: Decimal = Decimal("0")
    card_amount: Decimal = Decimal("0")
    tendered_amount: Decimal = Decimal("0")


class WalkInSaleOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    customer_id: uuid.UUID
    cash_amount: Decimal
    upi_amount: Decimal
    card_amount: Decimal
    tendered_amount: Decimal
    change_due: Decimal

    class Config:
        from_attributes = True


class WalkInSaleReceiptOut(BaseModel):
    """What the POS screen renders after checkout -- the invoice's
    resolved totals plus the sale's payment/change breakdown, in one
    response so the frontend doesn't need a second round-trip."""

    sale: WalkInSaleOut
    invoice_number: str
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
