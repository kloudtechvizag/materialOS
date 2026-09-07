import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)
QTY = Numeric(18, 4)


class CustomerItemPrice(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A standing customer-specific price, no time limit or quantity
    ceiling. Overridden by an active RateContract when one exists."""

    __tablename__ = "customer_item_prices"
    __table_args__ = (UniqueConstraint("customer_id", "item_id", name="uq_customer_item_price"),)

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)


class RateContract(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Part C: "a dated agreement with a quantity ceiling that overrides
    all other pricing and must be visible on every quote for that
    project" -- a first-class entity, not a price-list row.
    """

    __tablename__ = "rate_contracts"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rate: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    qty_ceiling: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    qty_consumed: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=0)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False)
