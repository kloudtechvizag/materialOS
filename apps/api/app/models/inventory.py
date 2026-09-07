import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)
QTY = Numeric(18, 4)


class StockLedger(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B3: append-only, immutable. Only 'opening' movements exist in
    Slice 0 (from the importer); Slice 1 adds purchase/sale/transfer/etc.
    Corrections are new reversing rows, never edits or deletes.
    """

    __tablename__ = "stock_ledger"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)  # signed
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    value: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)  # qty * rate, signed
    reference_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)


class StockBalance(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B3: materialised projection, rebuildable from stock_ledger at any
    time by services.inventory.rebuild_stock_balance. Never edited by
    hand -- only replaced wholesale by the rebuild job.
    """

    __tablename__ = "stock_balance"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "item_id", name="uq_stock_balance_warehouse_item"),
    )

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qty_on_hand: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=0)


class StockReservation(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B4: a soft hold, distinct from stock_balance.qty_on_hand (Part C:
    "Reservation ... releasable" vs "Allocation ... a hard link"). Never
    mutated in place across a status change history -- status moves
    forward (active -> fulfilled | released) and that's the whole model;
    the concurrency guarantee comes from services.inventory.reserve_stock
    taking a Postgres advisory lock keyed on (warehouse_id, item_id)
    before checking availability, not from row locking here.
    """

    __tablename__ = "stock_reservations"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active|fulfilled|released
    reference_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "sales_order"
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
