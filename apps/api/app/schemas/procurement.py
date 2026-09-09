import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class SupplierOut(BaseModel):
    id: uuid.UUID
    name: str
    gstin: str | None
    phone: str | None
    email: str | None
    billing_state: str | None
    category: str | None
    is_active: bool
    # Not real columns -- set as ad-hoc attributes on the ORM object by
    # the list endpoint's bulk aggregate query before serialization
    # (Pydantic's from_attributes reads them via plain getattr, same as
    # any mapped column). Absent (None) on any response built from a
    # bare Supplier row that skipped that step, e.g. the create response.
    outstanding_balance: Decimal | None = None
    open_purchase_orders: int | None = None

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    name: str
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    billing_state: str | None = None
    category: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    billing_state: str | None = None
    category: str | None = None
    is_active: bool | None = None


class SuppliersSummary(BaseModel):
    total_suppliers: int
    active_purchase_orders: int
    total_outstanding: Decimal
    missing_gstin_count: int


class Supplier360(BaseModel):
    supplier: SupplierOut
    payable: Decimal
    open_purchase_orders: int
    posted_bills: int


class POLineInput(BaseModel):
    item_id: uuid.UUID
    qty: Decimal
    rate: Decimal
    uom: str | None = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    warehouse_id: uuid.UUID
    lines: list[POLineInput]


class PurchaseOrderItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    uom: str
    rate: Decimal
    line_total: Decimal
    qty_received: Decimal

    class Config:
        from_attributes = True


class PurchaseOrderOut(BaseModel):
    id: uuid.UUID
    number: str
    supplier_id: uuid.UUID
    warehouse_id: uuid.UUID
    po_date: date
    status: str
    subtotal: Decimal
    items: list[PurchaseOrderItemOut] = []

    class Config:
        from_attributes = True


class ReceiveLineInput(BaseModel):
    purchase_order_item_id: uuid.UUID
    qty_received: Decimal
    qc_status: str = "passed"


class GoodsReceiptCreate(BaseModel):
    lines: list[ReceiveLineInput]


class GoodsReceiptItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty_received: Decimal
    rate: Decimal
    landed_unit_cost: Decimal
    qc_status: str

    class Config:
        from_attributes = True


class GoodsReceiptOut(BaseModel):
    id: uuid.UUID
    number: str
    purchase_order_id: uuid.UUID
    warehouse_id: uuid.UUID
    receipt_date: date
    status: str
    landed_cost_total: Decimal
    items: list[GoodsReceiptItemOut] = []

    class Config:
        from_attributes = True


class LandedCostCreate(BaseModel):
    cost_type: str
    amount: Decimal
    allocation_method: str = "value"


class PurchaseBillItemOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    rate: Decimal
    taxable_value: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class PurchaseBillOut(BaseModel):
    id: uuid.UUID
    number: str
    supplier_id: uuid.UUID
    goods_receipt_id: uuid.UUID
    bill_date: date
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    status: str
    items: list[PurchaseBillItemOut] = []

    class Config:
        from_attributes = True


class SupplierPaymentCreate(BaseModel):
    supplier_id: uuid.UUID
    amount: Decimal
    mode: str
    purchase_bill_id: uuid.UUID | None = None


class SupplierPaymentOut(BaseModel):
    id: uuid.UUID
    number: str
    supplier_id: uuid.UUID
    payment_date: date
    amount: Decimal
    mode: str

    class Config:
        from_attributes = True


class PurchaseReturnLineInput(BaseModel):
    purchase_bill_item_id: uuid.UUID
    qty: Decimal


class PurchaseReturnCreate(BaseModel):
    purchase_bill_id: uuid.UUID
    warehouse_id: uuid.UUID
    reason: str | None = None
    lines: list[PurchaseReturnLineInput]


class PurchaseReturnItemOut(BaseModel):
    id: uuid.UUID
    purchase_bill_item_id: uuid.UUID
    item_id: uuid.UUID
    qty: Decimal
    rate: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class PurchaseReturnOut(BaseModel):
    id: uuid.UUID
    number: str
    purchase_bill_id: uuid.UUID
    warehouse_id: uuid.UUID
    return_date: date
    reason: str | None
    total: Decimal
    items: list[PurchaseReturnItemOut] = []

    class Config:
        from_attributes = True
