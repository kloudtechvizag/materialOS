"""ADR-015: organization structure (Department/Designation) and the
Employee master, including its timeline (spec sec7) and the tenant-
configurable salary component catalog (spec sec35, seeded like
services/accounts.py::ensure_default_accounts).
"""
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.accounting import CostCenter
from app.models.hr import Department, Designation, Employee, EmployeeHistory
from app.models.payroll import SalaryComponent
from app.models.user import User

DEFAULT_SALARY_COMPONENTS: list[tuple[str, str, str, str, str | None, Decimal | None, Decimal | None, bool]] = [
    # code, name, type, calc_type, basis, default_amount, default_percentage, is_statutory
    # "Basic" itself is NOT a component -- EmployeeSalaryAssignment.basic
    # is a stored field set directly when salary is assigned/revised
    # (spec sec37); every component below is computed *relative to*
    # that stored basic/monthly_gross, not the other way around.
    ("HRA", "House Rent Allowance", "earning", "percentage", "basic", None, Decimal("40"), False),
    ("CONVEYANCE", "Conveyance Allowance", "earning", "fixed", None, Decimal("1600"), None, False),
    ("SPECIAL", "Special Allowance", "earning", "percentage", "gross", None, Decimal("10"), False),
    ("PF", "Provident Fund", "deduction", "percentage", "basic", None, Decimal("12"), True),
    ("PT", "Professional Tax", "deduction", "fixed", None, Decimal("200"), None, True),
]


def ensure_default_salary_components(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> None:
    """Illustrative defaults, not statutory fact (spec sec85: rates are
    admin-configurable, never hardcoded as if they were current law).
    PF's 12% and PT's flat ₹200/month are common patterns, not a
    guarantee of correctness for any given state/year -- an admin who
    knows their actual obligation edits these like any other Account."""
    existing = {c.code for c in db.execute(select(SalaryComponent).where(SalaryComponent.tenant_id == tenant_id, SalaryComponent.company_id == company_id)).scalars()}
    for code, name, ctype, calc_type, basis, amount, pct, statutory in DEFAULT_SALARY_COMPONENTS:
        if code not in existing:
            db.add(SalaryComponent(
                tenant_id=tenant_id, company_id=company_id, code=code, name=name, component_type=ctype,
                calculation_type=calc_type, percentage_basis=basis, default_amount=amount,
                default_percentage=pct, is_statutory=statutory,
            ))
    db.flush()


def ensure_default_departments(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> None:
    existing = {d.name for d in db.execute(select(Department).where(Department.tenant_id == tenant_id, Department.company_id == company_id)).scalars()}
    for name in ["Sales", "Warehouse", "Accounts", "Administration"]:
        if name not in existing:
            create_department(db, tenant_id=tenant_id, company_id=company_id, name=name)


def create_department(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str) -> Department:
    cost_center = CostCenter(tenant_id=tenant_id, name=name, center_type="department")
    db.add(cost_center)
    db.flush()
    department = Department(tenant_id=tenant_id, company_id=company_id, name=name, cost_center_id=cost_center.id)
    db.add(department)
    db.flush()
    return department


def _next_employee_code(db: Session, tenant_id: uuid.UUID) -> str:
    count = db.execute(select(func.count()).select_from(Employee).where(Employee.tenant_id == tenant_id)).scalar_one()
    return f"EMP-{count + 1:04d}"


def log_history(
    db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, event_type: str, description: str,
    old_value: dict | None = None, new_value: dict | None = None, effective_date: date | None = None,
    created_by_user_id: uuid.UUID | None = None,
) -> None:
    db.add(EmployeeHistory(
        tenant_id=tenant_id, employee_id=employee_id, event_type=event_type, description=description,
        old_value=old_value, new_value=new_value, effective_date=effective_date or date.today(),
        created_by_user_id=created_by_user_id,
    ))
    db.flush()


def create_employee(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID,
    created_by_user_id: uuid.UUID | None, **fields,
) -> Employee:
    if fields.get("reporting_manager_id"):
        manager = db.get(Employee, fields["reporting_manager_id"])
        if manager is None or manager.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Reporting manager not found.")

    employee = Employee(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch_id,
        employee_code=fields.pop("employee_code", None) or _next_employee_code(db, tenant_id),
        **fields,
    )
    db.add(employee)
    db.flush()

    log_history(
        db, tenant_id=tenant_id, employee_id=employee.id, event_type="joined",
        description=f"{employee.first_name} {employee.last_name} joined as {fields.get('employment_type', 'full_time').replace('_', ' ')}.",
        effective_date=employee.joining_date, created_by_user_id=created_by_user_id,
    )
    return employee


_TRACKED_FIELD_EVENTS = {
    "department_id": "department_changed",
    "designation_id": "designation_changed",
    "shift_id": "shift_changed",
    "status": "status_changed",
    "branch_id": "branch_transfer",
}


def update_employee(
    db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, updated_by_user_id: uuid.UUID | None, **fields,
) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None or employee.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Employee not found.", status_code=404)

    if fields.get("user_id"):
        linked_user = db.get(User, fields["user_id"])
        if linked_user is None or linked_user.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "User not found in this tenant.")
        already_linked = db.execute(
            select(Employee.id).where(Employee.tenant_id == tenant_id, Employee.user_id == fields["user_id"], Employee.id != employee_id)
        ).first()
        if already_linked:
            raise AppError(ErrorCode.CONFLICT, "That user is already linked to another employee.", status_code=409)

    for field, new_value in fields.items():
        if new_value is None or not hasattr(employee, field):
            continue
        old_value = getattr(employee, field)
        if old_value == new_value:
            continue
        setattr(employee, field, new_value)
        if field in _TRACKED_FIELD_EVENTS:
            log_history(
                db, tenant_id=tenant_id, employee_id=employee.id, event_type=_TRACKED_FIELD_EVENTS[field],
                description=f"{field.replace('_', ' ').title()} changed.",
                old_value={"value": str(old_value) if old_value else None}, new_value={"value": str(new_value)},
                created_by_user_id=updated_by_user_id,
            )
    db.flush()
    return employee


def get_employee_timeline(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID) -> list[EmployeeHistory]:
    return db.execute(
        select(EmployeeHistory).where(EmployeeHistory.tenant_id == tenant_id, EmployeeHistory.employee_id == employee_id)
        .order_by(EmployeeHistory.effective_date.desc(), EmployeeHistory.created_at.desc())
    ).scalars().all()


def get_employee_for_user(db: Session, *, tenant_id: uuid.UUID, user_id: uuid.UUID) -> Employee | None:
    """Self-service lookup -- "my attendance"/"my leave"/"my payslips"
    all resolve the caller's own Employee row this way."""
    return db.execute(select(Employee).where(Employee.tenant_id == tenant_id, Employee.user_id == user_id)).scalar_one_or_none()
