import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.leave import LeaveBalance, LeaveRequest, LeaveType
from app.models.user import User
from app.schemas.leave import (
    LeaveBalanceOut,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveReviewRequest,
    LeaveTypeOut,
)
from app.services import leave as leave_service
from app.services.hr import get_employee_for_user

router = APIRouter(prefix="/leave", tags=["leave"])


def _my_employee_id(db: Session, user: User) -> uuid.UUID:
    employee = get_employee_for_user(db, tenant_id=user.tenant_id, user_id=user.id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "No employee record is linked to your account.", status_code=404)
    return employee.id


@router.get("/types", response_model=list[LeaveTypeOut])
def list_leave_types(db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)) -> list[LeaveType]:
    return db.execute(select(LeaveType).where(LeaveType.is_active == True)).scalars().all()  # noqa: E712


@router.get("/balance/me", response_model=list[LeaveBalanceOut])
def my_leave_balance(year: int | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[LeaveBalance]:
    # A module-load-time default (e.g. `year: int = date.today().year`) would
    # freeze to whatever year the server process happened to start in --
    # resolved per-request instead.
    return leave_service.leave_balance_summary(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user), year=year or date.today().year)


@router.get("/balance/{employee_id}", response_model=list[LeaveBalanceOut])
def employee_leave_balance(employee_id: uuid.UUID, year: int | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("leave.view"))) -> list[LeaveBalance]:
    return leave_service.leave_balance_summary(db, tenant_id=user.tenant_id, employee_id=employee_id, year=year or date.today().year)


@router.post("/requests", response_model=LeaveRequestOut, status_code=201)
def create_leave_request(payload: LeaveRequestCreate, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> LeaveRequest:
    return leave_service.request_leave(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user), **payload.model_dump())


@router.get("/requests/me", response_model=list[LeaveRequestOut])
def my_leave_requests(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[LeaveRequest]:
    employee_id = _my_employee_id(db, user)
    return db.execute(select(LeaveRequest).where(LeaveRequest.employee_id == employee_id).order_by(LeaveRequest.created_at.desc())).scalars().all()


@router.get("/requests", response_model=list[LeaveRequestOut])
def list_leave_requests(status: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("leave.view"))) -> list[LeaveRequest]:
    stmt = select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    return db.execute(stmt).scalars().all()


@router.post("/requests/{leave_request_id}/review", response_model=LeaveRequestOut)
def review_leave_request(leave_request_id: uuid.UUID, payload: LeaveReviewRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("leave.approve"))) -> LeaveRequest:
    return leave_service.review_leave(db, tenant_id=user.tenant_id, leave_request_id=leave_request_id, approve=payload.approve, reviewed_by_user_id=user.id, review_notes=payload.review_notes)
