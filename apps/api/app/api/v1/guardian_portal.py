import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, get_portal_guardian, require_module
from app.models.education import Guardian
from app.schemas.announcements import GuardianAnnouncementOut
from app.schemas.examinations import ExaminationOut, ReportCardOut
from app.schemas.fees import FeeInvoiceOut
from app.schemas.guardian_portal import ChildSummaryOut, ChildTimetableEntryOut
from app.schemas.homework import StudentHomeworkEntryOut
from app.schemas.student_attendance import StudentAttendanceRecordOut
from app.services.announcements import list_visible_announcements_for_guardian, mark_announcement_read
from app.services.guardian_portal import (
    get_child_attendance,
    get_child_fees,
    get_child_homework,
    get_child_report_card,
    get_child_timetable,
    list_child_examinations,
    list_own_children,
)

router = APIRouter(prefix="/guardian-portal", tags=["guardian-portal"], dependencies=[Depends(require_module("education"))])


@router.get("/children", response_model=list[ChildSummaryOut])
def list_children(db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return list_own_children(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id)


@router.get("/children/{student_id}/attendance", response_model=list[StudentAttendanceRecordOut])
def child_attendance(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_attendance(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/homework", response_model=list[StudentHomeworkEntryOut])
def child_homework(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_homework(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/fees", response_model=list[FeeInvoiceOut])
def child_fees(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_fees(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/timetable", response_model=list[ChildTimetableEntryOut])
def child_timetable(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_timetable(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/examinations", response_model=list[ExaminationOut])
def child_examinations(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return list_child_examinations(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/examinations/{examination_id}/report-card", response_model=ReportCardOut)
def child_report_card(
    student_id: uuid.UUID, examination_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
):
    return get_child_report_card(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id, examination_id=examination_id)


@router.get("/announcements", response_model=list[GuardianAnnouncementOut])
def guardian_announcements(db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return list_visible_announcements_for_guardian(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id)


@router.post("/announcements/{announcement_id}/read", status_code=204)
def mark_announcement_read_endpoint(
    announcement_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
) -> None:
    mark_announcement_read(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, announcement_id=announcement_id)
