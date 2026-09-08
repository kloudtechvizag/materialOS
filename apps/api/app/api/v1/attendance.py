import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.attendance import AttendanceCorrection, AttendanceRecord
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCorrectionOut,
    AttendanceRecordOut,
    CorrectionRequestCreate,
    CorrectionReviewRequest,
)
from app.services import attendance as attendance_service
from app.services.hr import get_employee_for_user

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _my_employee_id(db: Session, user: User) -> uuid.UUID:
    employee = get_employee_for_user(db, tenant_id=user.tenant_id, user_id=user.id)
    if employee is None:
        raise AppError(ErrorCode.NOT_FOUND, "No employee record is linked to your account.", status_code=404)
    return employee.id


@router.post("/clock-in", response_model=AttendanceRecordOut)
def clock_in_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> AttendanceRecord:
    return attendance_service.clock_in(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user), method="web")


@router.post("/clock-out", response_model=AttendanceRecordOut)
def clock_out_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> AttendanceRecord:
    return attendance_service.clock_out(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user))


@router.get("/me", response_model=list[AttendanceRecordOut])
def my_attendance(from_date: date | None = None, to_date: date | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[AttendanceRecord]:
    employee_id = _my_employee_id(db, user)
    stmt = select(AttendanceRecord).where(AttendanceRecord.employee_id == employee_id).order_by(AttendanceRecord.attendance_date.desc())
    if from_date:
        stmt = stmt.where(AttendanceRecord.attendance_date >= from_date)
    if to_date:
        stmt = stmt.where(AttendanceRecord.attendance_date <= to_date)
    return db.execute(stmt).scalars().all()


@router.get("/today", response_model=list[AttendanceRecordOut])
def today_attendance(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("attendance.view"))) -> list[AttendanceRecord]:
    return db.execute(select(AttendanceRecord).where(AttendanceRecord.attendance_date == date.today())).scalars().all()


@router.get("", response_model=list[AttendanceRecordOut])
def list_attendance(
    employee_id: uuid.UUID | None = None, from_date: date | None = None, to_date: date | None = None,
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("attendance.view")),
) -> list[AttendanceRecord]:
    stmt = select(AttendanceRecord).order_by(AttendanceRecord.attendance_date.desc())
    if employee_id:
        stmt = stmt.where(AttendanceRecord.employee_id == employee_id)
    if from_date:
        stmt = stmt.where(AttendanceRecord.attendance_date >= from_date)
    if to_date:
        stmt = stmt.where(AttendanceRecord.attendance_date <= to_date)
    return db.execute(stmt).scalars().all()


@router.post("/corrections", response_model=AttendanceCorrectionOut, status_code=201)
def request_correction_endpoint(payload: CorrectionRequestCreate, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> AttendanceCorrection:
    return attendance_service.request_correction(db, tenant_id=user.tenant_id, employee_id=_my_employee_id(db, user), **payload.model_dump())


@router.get("/corrections", response_model=list[AttendanceCorrectionOut])
def list_corrections(status: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("attendance.approve"))) -> list[AttendanceCorrection]:
    stmt = select(AttendanceCorrection).order_by(AttendanceCorrection.created_at.desc())
    if status:
        stmt = stmt.where(AttendanceCorrection.status == status)
    return db.execute(stmt).scalars().all()


@router.post("/corrections/{correction_id}/review", response_model=AttendanceCorrectionOut)
def review_correction_endpoint(correction_id: uuid.UUID, payload: CorrectionReviewRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("attendance.approve"))) -> AttendanceCorrection:
    return attendance_service.review_correction(db, tenant_id=user.tenant_id, correction_id=correction_id, approve=payload.approve, reviewed_by_user_id=user.id, review_notes=payload.review_notes)
