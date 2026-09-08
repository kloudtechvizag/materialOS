import uuid
from datetime import date, datetime, time

from pydantic import BaseModel


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str


class DesignationOut(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class DesignationCreate(BaseModel):
    name: str


class ShiftOut(BaseModel):
    id: uuid.UUID
    name: str
    start_time: time
    end_time: time
    break_minutes: int
    grace_minutes: int
    is_night_shift: bool
    is_active: bool

    class Config:
        from_attributes = True


class ShiftCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    break_minutes: int = 0
    grace_minutes: int = 0
    is_night_shift: bool = False


class ShiftAssignRequest(BaseModel):
    shift_id: uuid.UUID
    effective_date: date


class EmployeeOut(BaseModel):
    """Deliberately excludes bank/PAN/statutory fields -- see
    EmployeeCompensationOut, gated by employee_compensation.view
    (spec sec77)."""

    id: uuid.UUID
    employee_code: str
    first_name: str
    last_name: str
    gender: str | None
    date_of_birth: date | None
    joining_date: date
    employment_type: str
    status: str
    company_id: uuid.UUID
    branch_id: uuid.UUID
    department_id: uuid.UUID | None
    designation_id: uuid.UUID | None
    reporting_manager_id: uuid.UUID | None
    shift_id: uuid.UUID | None
    email: str | None
    phone: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    address_line1: str | None
    city: str | None
    state: str | None
    pincode: str | None

    class Config:
        from_attributes = True


class EmployeeCompensationOut(BaseModel):
    bank_account_number: str | None
    bank_ifsc: str | None
    bank_name: str | None
    pan_number: str | None
    statutory_ids: dict

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    branch_id: uuid.UUID
    first_name: str
    last_name: str
    gender: str | None = None
    date_of_birth: date | None = None
    joining_date: date
    employment_type: str = "full_time"
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    reporting_manager_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None
    email: str | None = None
    phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None


class EmployeeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    status: str | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    reporting_manager_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    email: str | None = None
    phone: str | None = None
    # spec sec63: grants this employee self-service (mobile-web) login
    # to their own attendance/leave/payslips -- must be an existing
    # staff User in the same tenant (see api/v1/hr.py's validation).
    user_id: uuid.UUID | None = None


class EmployeeCompensationUpdate(BaseModel):
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    pan_number: str | None = None
    statutory_ids: dict | None = None


class EmployeeHistoryOut(BaseModel):
    id: uuid.UUID
    event_type: str
    description: str
    old_value: dict | None
    new_value: dict | None
    effective_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class HolidayOut(BaseModel):
    id: uuid.UUID
    holiday_date: date
    name: str

    class Config:
        from_attributes = True


class HolidayCreate(BaseModel):
    holiday_date: date
    name: str
