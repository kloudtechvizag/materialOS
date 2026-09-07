import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)


class Category(Base, UUIDPk, TenantMixin, TimestampMixin):
    """parameter_schema (ADR-003): list of {"name": str, "unit": str | null}
    describing which attributes items in this category are expected to
    carry in Item.attributes. Advisory only -- not a hard constraint.
    """

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "name", name="uq_categories_company_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parameter_schema: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class UnitConversion(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B2: qty always carries (value, uom, product_id); conversions go
    through convert(), which reads this table -- never a global constant.
    factor_to_base: 1 unit of `uom` equals this many units of the item's
    base_uom (e.g. 1 BUNDLE = 12 PCS if base_uom is PCS -> factor 12).
    """

    __tablename__ = "unit_conversions"
    __table_args__ = (UniqueConstraint("item_id", "uom", name="uq_unit_conversions_item_uom"),)

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uom: Mapped[str] = mapped_column(String(20), nullable=False)
    factor_to_base: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)


class Batch(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "batches"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    batch_code: Mapped[str] = mapped_column(String(50), nullable=False)
    manufactured_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    heat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
