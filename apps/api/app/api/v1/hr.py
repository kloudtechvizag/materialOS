import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.attendance import AttendanceRecord
from app.models.hr import Department, Designation, Employee, Holiday, HolidayCalendar, Shift
from app.models.leave import LeaveRequest
from app.models.tenant import Company
from app.models.user import User
from app.schemas.hr import (
    DepartmentCreate,
    DepartmentOut,
    DesignationCreate,
    DesignationOut,
    EmployeeCompensationOut,
    EmployeeCompensationUpdate,
    EmployeeCreate,
    EmployeeHistoryOut,
    EmployeeOut,
    EmployeeUpdate,
    HolidayCreate,
    HolidayOut,
    ShiftAssignRequest,
    ShiftCreate,
    ShiftOut,
)
from app.services import hr as hr_service
from app.services import shifts as shift_service

router = APIRouter(tags=["people"])


class DepartmentHeadcount(BaseModel):
    department_id: str | None
    department_name: str
    headcount: int


class PeopleOverviewOut(BaseModel):
    total_employees: int
    present_today: int
    absent_today: int
    late_today: int
    on_leave_today: int
    pending_leave_requests: int
    pending_advance_requests: int
    department_distribution: list[DepartmentHeadcount]


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


# ------------------------------------------------------------- Departments

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("departments.view"))) -> list[Department]:
    return db.execute(select(Department).where(Department.is_active == True).order_by(Department.name)).scalars().all()  # noqa: E712


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department_endpoint(payload: DepartmentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("departments.create"))) -> Department:
    company = _default_company(db, user.tenant_id)
    return hr_service.create_department(db, tenant_id=user.tenant_id, company_id=company.id, name=payload.name)


# ------------------------------------------------------------- Designations

@router.get("/designations", response_model=list[DesignationOut])
def list_designations(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employees.view"))) -> list[Designation]:
    return db.execute(select(Designation).where(Designation.is_active == True).order_by(Designation.name)).scalars().all()  # noqa: E712


@router.post("/designations", response_model=DesignationOut, status_code=201)
def create_designation(payload: DesignationCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.create"))) -> Designation:
    company = _default_company(db, user.tenant_id)
    designation = Designation(tenant_id=user.tenant_id, company_id=company.id, name=payload.name)
    db.add(designation)
    db.flush()
    return designation


# ------------------------------------------------------------- Shifts

@router.get("/shifts", response_model=list[ShiftOut])
def list_shifts(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("shifts.view"))) -> list[Shift]:
    return db.execute(select(Shift).where(Shift.is_active == True).order_by(Shift.name)).scalars().all()  # noqa: E712


@router.post("/shifts", response_model=ShiftOut, status_code=201)
def create_shift(payload: ShiftCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("shifts.create"))) -> Shift:
    company = _default_company(db, user.tenant_id)
    shift = Shift(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(shift)
    db.flush()
    return shift


@router.post("/employees/{employee_id}/shift", response_model=ShiftOut)
def assign_employee_shift(employee_id: uuid.UUID, payload: ShiftAssignRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("shifts.edit"))) -> Shift:
    shift_service.assign_shift(db, tenant_id=user.tenant_id, employee_id=employee_id, shift_id=payload.shift_id, effective_date=payload.effective_date, updated_by_user_id=user.id)
    return db.get(Shift, payload.shift_id)


# ------------------------------------------------------------- Employees

@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    department_id: uuid.UUID | None = None, status: str | None = None,
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employees.view")),
) -> list[Employee]:
    stmt = select(Employee).order_by(Employee.employee_code)
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)
    if status:
        stmt = stmt.where(Employee.status == status)
    return db.execute(stmt).scalars().all()


@router.get("/employees/me", response_model=EmployeeOut)
def get_my_employee_record(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> Employee:
    """Self-service anchor: /employees/me resolves the caller's own
    Employee row so mobile-web clock-in/leave/payslip screens don't
    need the employee_id up front."""
    employee = hr_service.get_employee_for_user(db, tenant_id=user.tenant_id, user_id=user.id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "No employee record is linked to your account.", status_code=404)
    return employee


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employees.view"))) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "Employee not found.", status_code=404)
    return employee


@router.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee_endpoint(payload: EmployeeCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.create"))) -> Employee:
    company = _default_company(db, user.tenant_id)
    return hr_service.create_employee(db, tenant_id=user.tenant_id, company_id=company.id, created_by_user_id=user.id, **payload.model_dump())


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee_endpoint(employee_id: uuid.UUID, payload: EmployeeUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.edit"))) -> Employee:
    return hr_service.update_employee(db, tenant_id=user.tenant_id, employee_id=employee_id, updated_by_user_id=user.id, **payload.model_dump(exclude_unset=True))


@router.get("/employees/{employee_id}/compensation", response_model=EmployeeCompensationOut)
def get_employee_compensation(employee_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employee_compensation.view"))) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "Employee not found.", status_code=404)
    return employee


@router.patch("/employees/{employee_id}/compensation", response_model=EmployeeCompensationOut)
def update_employee_compensation(employee_id: uuid.UUID, payload: EmployeeCompensationUpdate, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employee_compensation.edit"))) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "Employee not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)
    db.flush()
    return employee


@router.get("/employees/{employee_id}/timeline", response_model=list[EmployeeHistoryOut])
def get_employee_timeline_endpoint(employee_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.view"))) -> list:
    return hr_service.get_employee_timeline(db, tenant_id=user.tenant_id, employee_id=employee_id)


# ------------------------------------------------------------- Holidays

@router.get("/holidays", response_model=list[HolidayOut])
def list_holidays(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.view"))) -> list[Holiday]:
    calendar = db.execute(select(HolidayCalendar).where(HolidayCalendar.tenant_id == user.tenant_id)).scalars().first()
    if calendar is None:
        return []
    return db.execute(select(Holiday).where(Holiday.calendar_id == calendar.id).order_by(Holiday.holiday_date)).scalars().all()


@router.post("/holidays", response_model=HolidayOut, status_code=201)
def create_holiday(payload: HolidayCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.create"))) -> Holiday:
    company = _default_company(db, user.tenant_id)
    calendar = db.execute(select(HolidayCalendar).where(HolidayCalendar.tenant_id == user.tenant_id)).scalars().first()
    if calendar is None:
        calendar = HolidayCalendar(tenant_id=user.tenant_id, company_id=company.id, name="Default", is_default=True)
        db.add(calendar)
        db.flush()
    holiday = Holiday(tenant_id=user.tenant_id, calendar_id=calendar.id, **payload.model_dump())
    db.add(holiday)
    db.flush()
    return holiday


# ------------------------------------------------------------- Overview

@router.get("/people/overview", response_model=PeopleOverviewOut)
def people_overview(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employees.view"))) -> PeopleOverviewOut:
    """spec sec2's workforce dashboard -- every number here is a real,
    live query (no cached snapshot), the same discipline as
    system_health's checks."""
    from app.models.payroll import EmployeeAdvance

    active_employees = db.execute(select(Employee).where(Employee.tenant_id == user.tenant_id, Employee.status.in_(["active", "probation", "on_notice", "on_leave"]))).scalars().all()
    total = len(active_employees)

    today = date.today()
    today_records = {
        r.employee_id: r.status for r in db.execute(
            select(AttendanceRecord).where(AttendanceRecord.tenant_id == user.tenant_id, AttendanceRecord.attendance_date == today)
        ).scalars().all()
    }
    present_today = sum(1 for s in today_records.values() if s in ("present", "late", "half_day", "overtime"))
    late_today = sum(1 for s in today_records.values() if s == "late")
    on_leave_today = sum(1 for s in today_records.values() if s == "on_leave")
    absent_today = max(0, total - present_today - on_leave_today)

    pending_leave = db.execute(select(func.count()).select_from(LeaveRequest).where(LeaveRequest.tenant_id == user.tenant_id, LeaveRequest.status == "pending")).scalar_one()
    pending_advances = db.execute(select(func.count()).select_from(EmployeeAdvance).where(EmployeeAdvance.tenant_id == user.tenant_id, EmployeeAdvance.status == "pending")).scalar_one()

    departments = db.execute(select(Department).where(Department.tenant_id == user.tenant_id, Department.is_active == True)).scalars().all()  # noqa: E712
    dept_counts: dict[str | None, int] = {}
    for e in active_employees:
        dept_counts[e.department_id] = dept_counts.get(e.department_id, 0) + 1
    dept_by_id = {d.id: d.name for d in departments}
    distribution = [
        DepartmentHeadcount(department_id=str(dept_id) if dept_id else None, department_name=dept_by_id.get(dept_id, "Unassigned"), headcount=count)
        for dept_id, count in sorted(dept_counts.items(), key=lambda kv: -kv[1])
    ]

    return PeopleOverviewOut(
        total_employees=total, present_today=present_today, absent_today=absent_today, late_today=late_today,
        on_leave_today=on_leave_today, pending_leave_requests=pending_leave, pending_advance_requests=pending_advances,
        department_distribution=distribution,
    )
