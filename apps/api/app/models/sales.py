import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)
QTY = Numeric(18, 4)


class Quotation(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "quotations"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft|sent|approved|rejected|converted
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    tax_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)  # for margin display at quote time

    items: Mapped[list["QuotationItem"]] = relationship(order_by="QuotationItem.created_at")


class QuotationItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "quotation_items"

    quotation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    line_subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_tax: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class SalesOrder(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "sales_orders"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    # draft -> credit_hold | reserved -> dispatched -> invoiced ; cancelled at any point before dispatch
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    tax_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)

    items: Mapped[list["SalesOrderItem"]] = relationship(order_by="SalesOrderItem.created_at")


class SalesOrderItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "sales_order_items"

    sales_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    line_subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_tax: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    qty_dispatched: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=0)


class DeliveryChallan(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "delivery_challans"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="dispatched")

    items: Mapped[list["DeliveryChallanItem"]] = relationship(order_by="DeliveryChallanItem.created_at")


class DeliveryChallanItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "delivery_challan_items"

    delivery_challan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_challans.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_order_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_order_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)


class Invoice(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "invoices"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    delivery_challan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_challans.id", ondelete="SET NULL"), nullable=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    place_of_supply_state: Mapped[str] = mapped_column(String(100), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    tax_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    round_off: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="posted")  # posted|cancelled

    items: Mapped[list["InvoiceItem"]] = relationship(order_by="InvoiceItem.created_at")


class InvoiceItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    taxable_value: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    igst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    igst_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    line_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class Receipt(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "receipts"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)  # cash|upi|bank|card
    reference_note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PaymentAllocation(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "payment_allocations"

    receipt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
