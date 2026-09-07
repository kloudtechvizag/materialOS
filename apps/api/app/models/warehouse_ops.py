import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

QTY = Numeric(18, 4)


class StockTransfer(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §16: warehouse-to-warehouse movement, tracked through
    requested -> dispatched -> received. Each leg posts a real stock
    ledger movement (B3) -- nothing here mutates stock_balance directly.
    """

    __tablename__ = "stock_transfers"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    from_warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    to_warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")  # requested|dispatched|received

    items: Mapped[list["StockTransferItem"]] = relationship(order_by="StockTransferItem.created_at")


class StockTransferItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "stock_transfer_items"

    stock_transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)


class StockCount(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §18: select warehouse -> scan/count -> submit -> variance
    calculated -> manager approval -> adjustment posted. The count
    itself is a draft; only approval touches the ledger.
    """

    __tablename__ = "stock_counts"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft|submitted|approved
    counted_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    items: Mapped[list["StockCountItem"]] = relationship(order_by="StockCountItem.created_at")


class StockCountItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "stock_count_items"

    stock_count_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_counts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    system_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)  # snapshotted at count-creation time
    counted_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)

    @property
    def variance(self) -> Decimal:
        return self.counted_qty - self.system_qty


class SalesReturn(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §48. Scope note: this posts a reversing stock movement and
    a reversing journal entry, but not a formal GST credit note document
    (numbering, e-invoice cancellation rules) -- that belongs with the
    rest of Slice 4's compliance documents.
    """

    __tablename__ = "sales_returns"

    number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    items: Mapped[list["SalesReturnItem"]] = relationship(order_by="SalesReturnItem.created_at")


class SalesReturnItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "sales_return_items"

    sales_return_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoice_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
