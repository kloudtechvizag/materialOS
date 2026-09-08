"""ADR-015 (spec sec34-52). Payroll as a real, immutable-once-locked
financial record: SalaryComponent (tenant-configurable earnings/
deductions catalog, seeded like accounts -- see services/hr.py's
ensure_default_salary_components), EmployeeSalaryAssignment (versioned,
never overwritten -- a revision is a new row), PayrollRun (one per
period, carries the approval/lock state machine), PayrollItem (one row
per employee per run -- doubles as the payslip: there is no separate
`payslips` table because a PayrollItem *is* one, read-only once its
run is locked), and EmployeeAdvance.

Earnings/deductions breakdown is JSONB per item (`[{code, name,
amount}]`) rather than separate `payroll_earnings`/`payroll_deductions`
child tables -- same reasoning as Backup.table_counts and
NotificationRule.channels elsewhere in this codebase: a flexible,
admin-configurable list of line items doesn't need its own relational
table when nothing else ever joins against individual line rows.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)

PAYROLL_RUN_STATUSES = ["draft", "calculated", "pending_approval", "approved", "locked", "paid", "cancelled"]


class SalaryComponent(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "salary_components"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_salary_components_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    component_type: Mapped[str] = mapped_column(String(20), nullable=False)  # earning|deduction
    # Percentage components are computed against the assignment's
    # `monthly_gross` (e.g. HRA = 40% of basic -> stored as 40 with
    # basis="basic"); fixed components use `default_amount` directly.
    calculation_type: Mapped[str] = mapped_column(String(20), nullable=False, default="fixed")  # fixed|percentage
    percentage_basis: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "basic" | "gross"
    default_amount: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    default_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 3), nullable=True)
    is_statutory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class EmployeeSalaryAssignment(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "employee_salary_assignments"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    annual_ctc: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    monthly_gross: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    basic: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    # Snapshot of {component_code: amount} for fixed overrides beyond
    # basic -- percentage components are recomputed at payroll time
    # from the live SalaryComponent config, fixed ones can be overridden
    # per employee here (e.g. a custom conveyance amount).
    component_overrides: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    overtime_hourly_rate: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class PayrollRun(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "period_start", "period_end", name="uq_payroll_runs_period"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    period_label: Mapped[str] = mapped_column(String(50), nullable=False)  # "September 2026"
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    total_gross: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total_deductions: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total_net: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total_employer_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PayrollItem(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One row per employee per run -- also the payslip (spec sec48):
    read this row back once its run is `locked`/`paid` and you have
    everything a payslip needs."""

    __tablename__ = "payroll_items"
    __table_args__ = (UniqueConstraint("tenant_id", "payroll_run_id", "employee_id", name="uq_payroll_items_run_employee"),)

    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False, index=True)
    working_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    present_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    leave_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    lop_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    gross_earnings: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    total_deductions: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    net_pay: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    earnings_breakdown: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # [{code, name, amount}]
    deductions_breakdown: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    exceptions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # sec46: warnings surfaced pre-approval


class EmployeeAdvance(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "employee_advances"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|approved|rejected|paid
    monthly_deduction_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    outstanding_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
