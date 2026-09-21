import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.models.student_attendance import StudentAttendanceRecord
from app.models.user import User
from app.schemas.student_attendance import BulkMarkRequest, RosterEntryOut, StudentAttendanceRecordOut
from app.services.student_attendance import get_roster, get_student_attendance_history, mark_bulk_attendance

router = APIRouter(tags=["student-attendance"], dependencies=[Depends(require_module("education"))])


@router.get("/student-attendance/roster", response_model=list[RosterEntryOut])
def roster(
    section_id: uuid.UUID, attendance_date: date, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("student_attendance.view"))
) -> list[dict]:
    return get_roster(db, tenant_id=user.tenant_id, section_id=section_id, attendance_date=attendance_date)


@router.post("/student-attendance/bulk", response_model=list[StudentAttendanceRecordOut])
def mark_bulk(
    payload: BulkMarkRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("student_attendance.create"))
) -> list[StudentAttendanceRecord]:
    return mark_bulk_attendance(
        db, tenant_id=user.tenant_id, section_id=payload.section_id, attendance_date=payload.attendance_date,
        marked_by_user_id=user.id, records=[r.model_dump() for r in payload.records],
    )


@router.get("/student-attendance", response_model=list[StudentAttendanceRecordOut])
def student_history(
    student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("student_attendance.view"))
) -> list[StudentAttendanceRecord]:
    return get_student_attendance_history(db, tenant_id=user.tenant_id, student_id=student_id)
