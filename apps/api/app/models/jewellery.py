import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)


class MetalRate(Base, UUIDPk, TenantMixin, TimestampMixin):
    """The Jewellery industry profile's pricing_strategy is
    "weight_making_wastage" (services/industry.py), but no live gold-
    rate feed exists or is integrated -- the same "refuse rather than
    fake" discipline as ADR-007's e-invoice/e-way adapters applies here:
    a jewellery shop enters today's own rate by hand, exactly like every
    real jewellery billing product does (rates move daily and the owner
    already knows the number from their own bullion dealer), rather
    than this system fabricating a market price. `resolve_price()`
    (services/pricing.py) reads the most recent row at or before the
    pricing date for a given metal+purity.
    """

    __tablename__ = "metal_rates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "metal", "purity", "effective_date", name="uq_metal_rates_company_metal_purity_date"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    metal: Mapped[str] = mapped_column(String(20), nullable=False)  # gold | silver | platinum
    purity: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g. "24K", "22K", "18K", "925"
    rate_per_gram: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
