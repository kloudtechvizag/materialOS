import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class LeaveTypeOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    annual_allocation_days: Decimal
    allow_half_day: bool
    is_paid: bool
    is_active: bool

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    leave_type_id: uuid.UUID
    year: int
    allocated_days: Decimal
    used_days: Decimal
    carried_forward_days: Decimal

    class Config:
        from_attributes = True


class LeaveRequestCreate(BaseModel):
    leave_type_id: uuid.UUID
    start_date: date
    end_date: date
    half_day: bool = False
    reason: str | None = None


class LeaveReviewRequest(BaseModel):
    approve: bool
    review_notes: str | None = None


class LeaveRequestOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    start_date: date
    end_date: date
    days: Decimal
    half_day: bool
    reason: str | None
    status: str
    reviewed_at: datetime | None
    review_notes: str | None

    class Config:
        from_attributes = True
