import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class SalaryComponentOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    component_type: str
    calculation_type: str
    percentage_basis: str | None
    default_amount: Decimal | None
    default_percentage: Decimal | None
    is_statutory: bool

    class Config:
        from_attributes = True


class SalaryAssignmentCreate(BaseModel):
    effective_date: date
    annual_ctc: Decimal
    monthly_gross: Decimal
    basic: Decimal
    component_overrides: dict = {}
    overtime_hourly_rate: Decimal | None = None
    reason: str | None = None


class SalaryAssignmentOut(BaseModel):
    id: uuid.UUID
    effective_date: date
    end_date: date | None
    annual_ctc: Decimal
    monthly_gross: Decimal
    basic: Decimal
    component_overrides: dict
    overtime_hourly_rate: Decimal | None
    is_active: bool
    reason: str | None

    class Config:
        from_attributes = True


class PayrollRunCreate(BaseModel):
    period_start: date
    period_end: date
    period_label: str


class PayrollRunOut(BaseModel):
    id: uuid.UUID
    period_label: str
    period_start: date
    period_end: date
    status: str
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    total_employer_cost: Decimal
    calculated_at: datetime | None
    approved_at: datetime | None
    locked_at: datetime | None
    paid_at: datetime | None

    class Config:
        from_attributes = True


class PayrollLineItem(BaseModel):
    code: str
    name: str
    amount: str


class PayrollItemOut(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    employee_id: uuid.UUID
    working_days: Decimal
    present_days: Decimal
    leave_days: Decimal
    lop_days: Decimal
    overtime_hours: Decimal
    gross_earnings: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    earnings_breakdown: list[dict]
    deductions_breakdown: list[dict]
    exceptions: list[dict]

    class Config:
        from_attributes = True


class AdvanceRequestCreate(BaseModel):
    amount: Decimal
    monthly_deduction_amount: Decimal
    reason: str | None = None


class AdvanceOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    amount: Decimal
    reason: str | None
    status: str
    monthly_deduction_amount: Decimal
    outstanding_amount: Decimal
    approved_at: datetime | None
    paid_at: datetime | None

    class Config:
        from_attributes = True
