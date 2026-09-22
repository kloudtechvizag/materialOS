import mimetypes
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.billing.gateway import is_sandbox
from app.deps import get_db_tenant, get_portal_guardian, require_module
from app.models.education import Guardian
from app.schemas.announcements import GuardianAnnouncementOut
from app.schemas.examinations import ExaminationOut, ReportCardOut
from app.schemas.fee_payment import FeeCheckoutOut, FeePaymentOut, SimulateFeePaymentRequest
from app.schemas.fees import FeeInvoiceOut
from app.schemas.guardian_portal import ChildSummaryOut, ChildTimetableEntryOut
from app.schemas.homework import StudentHomeworkEntryOut
from app.schemas.student_attendance import StudentAttendanceRecordOut
from app.schemas.hostel import StudentHostelOut
from app.schemas.library import BookIssueOut
from app.schemas.transport import StudentTransportOut
from app.services.announcements import get_guardian_visible_announcement, list_visible_announcements_for_guardian, mark_announcement_read
from app.services.fee_payment import checkout as fee_payment_checkout, simulate_payment_result as simulate_fee_payment_result
from app.services.guardian_portal import (
    get_child_attendance,
    get_child_fees,
    get_child_homework,
    get_child_homework_attachment,
    get_child_hostel,
    get_child_library,
    get_child_report_card,
    get_child_timetable,
    get_child_transport,
    list_child_examinations,
    list_own_children,
)
from app.storage import read_file

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


@router.get("/children/{student_id}/homework/{homework_id}/attachment")
def child_homework_attachment(
    student_id: uuid.UUID, homework_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
) -> Response:
    homework = get_child_homework_attachment(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id, homework_id=homework_id)
    content = read_file(homework.attachment_path)
    media_type = mimetypes.guess_type(homework.attachment_file_name or "")[0] or "application/octet-stream"
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{homework.attachment_file_name}"'})


@router.get("/children/{student_id}/fees", response_model=list[FeeInvoiceOut])
def child_fees(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_fees(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.post("/children/{student_id}/fees/{fee_invoice_id}/checkout", response_model=FeeCheckoutOut)
def child_fee_checkout(
    student_id: uuid.UUID, fee_invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
):
    payment, order = fee_payment_checkout(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id, fee_invoice_id=fee_invoice_id)
    return FeeCheckoutOut(payment=FeePaymentOut.model_validate(payment), order_id=order.order_id, amount=order.amount, currency=order.currency, is_sandbox=is_sandbox())


@router.post("/fee-payments/{payment_id}/simulate", response_model=FeePaymentOut)
def simulate_fee_payment(
    payment_id: uuid.UUID, payload: SimulateFeePaymentRequest, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
):
    """Sandbox-only dev/demo helper standing in for the gateway's real
    async callback -- see services/fee_payment.py's docstring. Refuses
    if a live provider is configured."""
    return simulate_fee_payment_result(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, payment_id=payment_id, succeed=payload.succeed)


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


@router.get("/children/{student_id}/transport", response_model=StudentTransportOut | None)
def child_transport(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_transport(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/library", response_model=list[BookIssueOut])
def child_library(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_library(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/children/{student_id}/hostel", response_model=StudentHostelOut | None)
def child_hostel(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return get_child_hostel(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, student_id=student_id)


@router.get("/announcements", response_model=list[GuardianAnnouncementOut])
def guardian_announcements(db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)):
    return list_visible_announcements_for_guardian(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id)


@router.post("/announcements/{announcement_id}/read", status_code=204)
def mark_announcement_read_endpoint(
    announcement_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
) -> None:
    mark_announcement_read(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, announcement_id=announcement_id)


@router.get("/announcements/{announcement_id}/attachment")
def guardian_announcement_attachment(
    announcement_id: uuid.UUID, db: Session = Depends(get_db_tenant), guardian: Guardian = Depends(get_portal_guardian)
) -> Response:
    announcement = get_guardian_visible_announcement(db, tenant_id=guardian.tenant_id, guardian_id=guardian.id, announcement_id=announcement_id)
    content = read_file(announcement.attachment_path)
    media_type = mimetypes.guess_type(announcement.attachment_file_name or "")[0] or "application/octet-stream"
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{announcement.attachment_file_name}"'})
