import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.payroll import EmployeeAdvance, EmployeeSalaryAssignment, PayrollItem, PayrollRun, SalaryComponent
from app.models.tenant import Company
from app.models.user import Permission, RolePermission, User, UserRole
from app.schemas.payroll import (
    AdvanceOut,
    AdvanceRequestCreate,
    PayrollItemOut,
    PayrollRunCreate,
    PayrollRunOut,
    SalaryAssignmentCreate,
    SalaryAssignmentOut,
    SalaryComponentOut,
)
from app.services import advances as advances_service
from app.services import payroll as payroll_service
from app.services.hr import get_employee_for_user

router = APIRouter(tags=["payroll"])


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


def _my_employee_id(db: Session, user: User) -> uuid.UUID:
    employee = get_employee_for_user(db, tenant_id=user.tenant_id, user_id=user.id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "No employee record is linked to your account.", status_code=404)
    return employee.id


def _user_has_permission(db: Session, *, user_id: uuid.UUID, code: str) -> bool:
    return db.execute(
        select(RolePermission.id).join(UserRole, UserRole.role_id == RolePermission.role_id).join(Permission, Permission.id == RolePermission.permission_id)
        .where(UserRole.user_id == user_id, Permission.code == code)
    ).first() is not None


# ------------------------------------------------------------- Salary components + assignments

@router.get("/salary-components", response_model=list[SalaryComponentOut])
def list_salary_components(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employee_compensation.view"))) -> list[SalaryComponent]:
    return db.execute(select(SalaryComponent).where(SalaryComponent.is_active == True)).scalars().all()  # noqa: E712


@router.post("/employees/{employee_id}/salary", response_model=SalaryAssignmentOut, status_code=201)
def assign_salary(employee_id: uuid.UUID, payload: SalaryAssignmentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("employee_compensation.edit"))) -> EmployeeSalaryAssignment:
    existing = db.execute(
        select(EmployeeSalaryAssignment).where(EmployeeSalaryAssignment.tenant_id == user.tenant_id, EmployeeSalaryAssignment.employee_id == employee_id, EmployeeSalaryAssignment.is_active == True)  # noqa: E712
    ).scalars().all()
    for a in existing:
        a.is_active = False
        a.end_date = payload.effective_date

    assignment = EmployeeSalaryAssignment(tenant_id=user.tenant_id, employee_id=employee_id, approved_by_user_id=user.id, **payload.model_dump())
    db.add(assignment)
    db.flush()

    from app.services.hr import log_history

    log_history(
        db, tenant_id=user.tenant_id, employee_id=employee_id, event_type="salary_revision",
        description=f"Salary revised: monthly gross ₹{payload.monthly_gross}.",
        new_value={"monthly_gross": str(payload.monthly_gross), "annual_ctc": str(payload.annual_ctc)},
        effective_date=payload.effective_date, created_by_user_id=user.id,
    )
    return assignment


@router.get("/employees/{employee_id}/salary", response_model=list[SalaryAssignmentOut])
def list_salary_assignments(employee_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("employee_compensation.view"))) -> list[EmployeeSalaryAssignment]:
    return db.execute(select(EmployeeSalaryAssignment).where(EmployeeSalaryAssignment.employee_id == employee_id).order_by(EmployeeSalaryAssignment.effective_date.desc())).scalars().all()


# ------------------------------------------------------------- Payroll runs

@router.get("/payroll/runs", response_model=list[PayrollRunOut])
def list_payroll_runs(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("payroll.view"))) -> list[PayrollRun]:
    return db.execute(select(PayrollRun).order_by(PayrollRun.period_start.desc())).scalars().all()


@router.post("/payroll/runs", response_model=PayrollRunOut, status_code=201)
def create_run(payload: PayrollRunCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("payroll.calculate"))) -> PayrollRun:
    company = _default_company(db, user.tenant_id)
    return payroll_service.create_payroll_run(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/payroll/runs/{run_id}", response_model=PayrollRunOut)
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("payroll.view"))) -> PayrollRun:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise AppError(ErrorCode.NOT_FOUND, "Payroll run not found.", status_code=404)
    return run


@router.post("/payroll/runs/{run_id}/calculate", response_model=PayrollRunOut)
def calculate_run(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("payroll.calculate"))) -> PayrollRun:
    return payroll_service.calculate_payroll_run(db, tenant_id=user.tenant_id, payroll_run_id=run_id)


@router.post("/payroll/runs/{run_id}/approve", response_model=PayrollRunOut)
def approve_run(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("payroll.approve"))) -> PayrollRun:
    return payroll_service.approve_payroll_run(db, tenant_id=user.tenant_id, payroll_run_id=run_id, approved_by_user_id=user.id)


@router.post("/payroll/runs/{run_id}/lock", response_model=PayrollRunOut)
def lock_run(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("payroll.lock"))) -> PayrollRun:
    return payroll_service.lock_payroll_run(db, tenant_id=user.tenant_id, payroll_run_id=run_id)


@router.post("/payroll/runs/{run_id}/pay", response_model=PayrollRunOut)
def pay_run(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("payroll.pay"))) -> PayrollRun:
    return payroll_service.pay_payroll_run(db, tenant_id=user.tenant_id, payroll_run_id=run_id)


@router.get("/payroll/runs/{run_id}/items", response_model=list[PayrollItemOut])
def list_run_items(run_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("payroll.view"))) -> list[PayrollItem]:
    return db.execute(select(PayrollItem).where(PayrollItem.payroll_run_id == run_id)).scalars().all()


# ------------------------------------------------------------- Payslips

@router.get("/payslips/me", response_model=list[PayrollItemOut])
def my_payslips(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[PayrollItem]:
    employee_id = _my_employee_id(db, user)
    return db.execute(
        select(PayrollItem).join(PayrollRun, PayrollRun.id == PayrollItem.payroll_run_id)
        .where(PayrollItem.employee_id == employee_id, PayrollRun.status.in_(["locked", "paid"]))
        .order_by(PayrollRun.period_start.desc())
    ).scalars().all()


@router.get("/payslips/{item_id}", response_model=PayrollItemOut)
def get_payslip(item_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> PayrollItem:
    item = db.get(PayrollItem, item_id)
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "Payslip not found.", status_code=404)
    run = db.get(PayrollRun, item.payroll_run_id)
    if run.status not in ("locked", "paid"):
        raise AppError(ErrorCode.VALIDATION_ERROR, "This payslip is not finalized yet.")
    my_employee = get_employee_for_user(db, tenant_id=user.tenant_id, user_id=user.id)
    is_own = my_employee is not None and my_employee.id == item.employee_id
    # Not the caller's own payslip -- fall back to the payroll.view
    # permission (can't express "own resource OR this permission" via
    # FastAPI's Depends() alone, so it's checked explicitly here).
    if not is_own and not _user_has_permission(db, user_id=user.id, code="payroll.view"):
        raise AppError(ErrorCode.FORBIDDEN, "Missing permission: payroll.view.", status_code=403, details={"permission": "payroll.view"})
    return item


# ------------------------------------------------------------- Advances

@router.post("/advances", response_model=AdvanceOut, status_code=201)
def request_advance_endpoint(payload: AdvanceRequestCreate, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> EmployeeAdvance:
    return advances_service.request_advance(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user), **payload.model_dump())


@router.get("/advances/me", response_model=list[AdvanceOut])
def my_advances(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[EmployeeAdvance]:
    employee_id = _my_employee_id(db, user)
    return db.execute(select(EmployeeAdvance).where(EmployeeAdvance.employee_id == employee_id).order_by(EmployeeAdvance.created_at.desc())).scalars().all()


@router.get("/advances", response_model=list[AdvanceOut])
def list_advances(status: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("advances.approve"))) -> list[EmployeeAdvance]:
    stmt = select(EmployeeAdvance).order_by(EmployeeAdvance.created_at.desc())
    if status:
        stmt = stmt.where(EmployeeAdvance.status == status)
    return db.execute(stmt).scalars().all()


@router.post("/advances/{advance_id}/approve", response_model=AdvanceOut)
def approve_advance_endpoint(advance_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("advances.approve"))) -> EmployeeAdvance:
    return advances_service.approve_advance(db, tenant_id=user.tenant_id, advance_id=advance_id, approved_by_user_id=user.id)


@router.post("/advances/{advance_id}/pay", response_model=AdvanceOut)
def pay_advance_endpoint(advance_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("advances.approve"))) -> EmployeeAdvance:
    return advances_service.mark_advance_paid(db, tenant_id=user.tenant_id, advance_id=advance_id)
