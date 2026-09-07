import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)


class Customer(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Minimal master for Slice 0 (Tally/Busy import). Rate contracts,
    price lists, and the WalkInSale split (Part C) are Slice 1.
    """

    __tablename__ = "customers"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_state: Mapped[str | None] = mapped_column(String(100), nullable=True)  # place-of-supply default (D2/D3)
    credit_limit: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    credit_days: Mapped[int] = mapped_column(nullable=False, default=0)
    opening_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    opening_balance_as_of: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_ledger_name: Mapped[str | None] = mapped_column(String(200), nullable=True)  # Tally/Busy traceability
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Supplier(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "suppliers"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    opening_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    opening_balance_as_of: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_ledger_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Item(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Item master. Slice 0 gave it identity + tax fields; Slice 1 adds
    dynamic parameters (ADR-003), pricing, and cost so the price/margin
    engine and quotations have something to read.
    """

    __tablename__ = "items"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "sku", name="uq_items_company_sku"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    hsn_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    base_uom: Mapped[str] = mapped_column(String(20), nullable=False)
    source_stock_item_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    standard_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    min_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    # Landed cost without a Purchase module (that's Slice 3): manually
    # maintained, seeded from the importer's opening rate where known.
    standard_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
