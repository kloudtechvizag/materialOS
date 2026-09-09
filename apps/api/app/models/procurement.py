import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)
QTY = Numeric(18, 4)


class PurchaseOrder(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_orders"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    po_date: Mapped[date] = mapped_column(Date, nullable=False)
    # draft -> approved -> partially_received -> received ; or cancelled before receipt
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)

    items: Mapped[list["PurchaseOrderItem"]] = relationship(order_by="PurchaseOrderItem.created_at")


class PurchaseOrderItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_order_items"

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    qty_received: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=0)


class GoodsReceipt(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "goods_receipts"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="received")
    # Landed cost, summed across LandedCostEntry rows and allocated into
    # each line's effective unit cost (ADR-006).
    landed_cost_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)

    items: Mapped[list["GoodsReceiptItem"]] = relationship(order_by="GoodsReceiptItem.created_at")
    landed_costs: Mapped[list["LandedCostEntry"]] = relationship(order_by="LandedCostEntry.created_at")


class GoodsReceiptItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "goods_receipt_items"

    goods_receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("goods_receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_order_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_order_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty_received: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)  # PO rate, before landed cost allocation
    landed_unit_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)  # rate + allocated share
    qc_status: Mapped[str] = mapped_column(String(20), nullable=False, default="passed")  # passed|failed|pending


class LandedCostEntry(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §34: freight/loading/unloading/insurance/handling, allocated
    by quantity or value across a goods receipt's lines."""

    __tablename__ = "landed_cost_entries"

    goods_receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("goods_receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    cost_type: Mapped[str] = mapped_column(String(50), nullable=False)  # freight|loading|unloading|insurance|handling|other
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    allocation_method: Mapped[str] = mapped_column(String(20), nullable=False, default="value")  # value|quantity


class PurchaseBill(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_bills"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    goods_receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("goods_receipts.id", ondelete="RESTRICT"), nullable=False, index=True)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    tax_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="posted")

    items: Mapped[list["PurchaseBillItem"]] = relationship(order_by="PurchaseBillItem.created_at")


class PurchaseBillItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_bill_items"

    purchase_bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    taxable_value: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cgst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    igst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class PurchaseReturn(Base, UUIDPk, TenantMixin, TimestampMixin):
    """The purchase-side mirror of warehouse_ops.SalesReturn: goods sent
    back to a supplier against a posted bill, reversing both the stock
    ledger and the bill's journal postings. Printable via the receipt
    engine as document_type="debit_note" (services/receipt_templates.py)
    -- AP goes down, the supplier owes us this amount back or it's set
    against their next bill, exactly as a real GST debit note works.
    """

    __tablename__ = "purchase_returns"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    purchase_bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bills.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)

    items: Mapped[list["PurchaseReturnItem"]] = relationship(order_by="PurchaseReturnItem.created_at")


class PurchaseReturnItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_return_items"

    purchase_return_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_bill_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bill_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class SupplierPayment(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "supplier_payments"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)


class SupplierPaymentAllocation(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "supplier_payment_allocations"

    supplier_payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("supplier_payments.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bills.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
