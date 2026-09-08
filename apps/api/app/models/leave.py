"""ADR-015 (spec sec26-31). LeaveType/LeavePolicy are folded into one
table (`LeaveType` carries its own policy fields) rather than a
separate `leave_policies` table -- every tenant's leave policy today
is "this type, this many days a year, paid or not, half-day allowed or
not"; a genuinely separate accrual/expiry engine is real future scope,
not something worth a second table with nothing in it yet.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class LeaveType(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "leave_types"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_leave_types_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)  # "casual" | "sick" | "earned" | ...
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    annual_allocation_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    allow_half_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LeaveBalance(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "leave_balances"
    __table_args__ = (UniqueConstraint("tenant_id", "employee_id", "leave_type_id", "year", name="uq_leave_balances_employee_type_year"),)

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    used_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    carried_forward_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)


class LeaveRequest(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "leave_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    half_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|approved|rejected|cancelled
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
