import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Tenant(Base, UUIDPk, TimestampMixin):
    """Platform root. Not itself RLS-scoped -- everything else hangs off it."""

    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")


class Company(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # ADR-016: the receipt/invoice header's own phone/email -- previously
    # not modeled at all (only a customer/supplier's contact details
    # existed), so a receipt had no real business phone/email to show.
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    financial_year_start_month: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Nullable: pre-existing companies are backfilled by the introducing
    # migration; new signups set this explicitly (see tenant_signup.py).
    # No RLS implication -- industry_profiles is platform data (see
    # models/industry.py), this is just an FK on an already-RLS'd table.
    industry_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("industry_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # D2: AATO > 5cr in any FY makes e-invoicing mandatory and permanent
    # once crossed -- that is a compliance fact about the business, not
    # something derivable from data this system has (it needs full,
    # multi-year turnover including pre-MaterialOS history). An admin
    # who knows the answer flips this switch; see ADR-007.
    e_invoice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    e_way_bill_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Branch(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "branches"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Warehouse(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Minimal godown master for Slice 0/1. Zones/racks/bins are Slice 1+."""

    __tablename__ = "warehouses"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
