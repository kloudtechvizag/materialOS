"""ADR-015: People & Payroll's organization layer -- Department,
Designation, Employee (the central master), its timeline, Shift, and
the holiday calendar. All tenant-scoped, RLS+audit like every other
tenant table.

Employee is deliberately its own entity, not a repurposed User: not
every employee needs system login (a production worker or driver may
be tracked for attendance/payroll with no account at all), so
`user_id` is nullable -- set only for employees who get self-service
access. `Driver` (models/fleet.py) is a separate, pre-existing entity
this pass does not merge into Employee -- see the ADR for why.
"""
import uuid
from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

EMPLOYMENT_TYPES = [
    "full_time", "part_time", "contract", "temporary", "intern", "apprentice",
    "consultant", "daily_wage", "hourly", "commission_based", "freelancer",
]

EMPLOYEE_STATUSES = [
    "active", "probation", "on_notice", "on_leave", "suspended", "inactive", "resigned", "terminated", "retired",
]

HISTORY_EVENT_TYPES = [
    "joined", "department_changed", "designation_changed", "promotion", "salary_revision",
    "shift_changed", "branch_transfer", "status_changed", "resigned",
]


class Department(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "name", name="uq_departments_company_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # spec sec52: payroll cost reportable by department -- a real
    # CostCenter row (center_type="department"), not a parallel
    # reporting dimension. Auto-created alongside the department.
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Designation(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "designations"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "name", name="uq_designations_company_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Shift(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "shifts"

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_night_shift: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Employee(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (UniqueConstraint("tenant_id", "employee_code", name="uq_employees_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    # Nullable: set only when this employee also gets a staff login
    # (self-service). RESTRICT, not CASCADE -- deactivating login access
    # is done via User.is_active, never by orphaning payroll history.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    employee_code: Mapped[str] = mapped_column(String(30), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)

    employment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="full_time")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="SET NULL"), nullable=True, index=True)
    reporting_manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    shift_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True, index=True)

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Sensitive -- excluded from the default EmployeeOut schema, only
    # returned by the employee_compensation.view-gated endpoint (spec
    # sec77's "salary information must have separate permissions from
    # basic employee information").
    bank_account_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bank_ifsc: Mapped[str | None] = mapped_column(String(15), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Free-form for other statutory IDs (UAN, ESI number, ...) -- kept
    # generic/JSONB rather than a fixed set of India-only columns, same
    # reasoning as IndustryProfile's inventory_flags (ADR-010): future
    # jurisdictions add keys here, not new migrations.
    statutory_ids: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class EmployeeHistory(Base, UUIDPk, TenantMixin, TimestampMixin):
    """spec sec7's timeline -- appended by services/hr.py whenever a
    tracked field actually changes (department/designation/shift/
    status/salary), not a generic audit mirror (audit_log, ADR-013,
    already captures every raw column change; this is the human-
    readable HR narrative of the meaningful ones)."""

    __tablename__ = "employee_history"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class ShiftAssignment(Base, UUIDPk, TenantMixin, TimestampMixin):
    """spec sec14: an effective-dated assignment, not a 7-day grid --
    "what shift is this employee on as of date X" is answered by the
    most recent row with effective_date <= X and (end_date is null or
    end_date >= X). A full weekly roster calendar UI can be layered on
    top of this later without a schema change; not built this pass."""

    __tablename__ = "shift_assignments"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="RESTRICT"), nullable=False, index=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class HolidayCalendar(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "holiday_calendars"

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Holiday(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "holidays"

    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("holiday_calendars.id", ondelete="CASCADE"), nullable=False, index=True)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
