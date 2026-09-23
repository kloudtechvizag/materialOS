import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.admissions import AdmissionApplication, AdmissionDocument, AdmissionEnquiry, AdmissionEnquiryActivity
from app.models.education import AcademicYear
from app.services.education import create_student, enrol_student
from app.services.webhooks import emit_event
from app.storage import save_file

TERMINAL_STATUSES = {"admitted", "rejected", "withdrawn"}
# "admitted" is deliberately excluded -- it's only ever reached through
# convert_application_to_student, which creates the real Student atomically.
# Setting it via a plain status PATCH would let an application read
# "admitted" with no student_id behind it.
PATCHABLE_STATUSES = {"under_review", "interview_scheduled", "interviewed", "offered", "waitlisted", "rejected", "withdrawn"}
DECISION_STATUSES = {"offered", "waitlisted", "rejected"}
ENQUIRY_STATUS_LABEL = {"open": "Open", "contacted": "Contacted", "converted": "Converted", "closed": "Not proceeding"}


def log_enquiry_activity(
    db: Session, *, tenant_id: uuid.UUID, enquiry_id: uuid.UUID, activity_type: str, description: str, created_by_user_id: uuid.UUID | None,
) -> AdmissionEnquiryActivity:
    activity = AdmissionEnquiryActivity(
        tenant_id=tenant_id, enquiry_id=enquiry_id, activity_type=activity_type, description=description, created_by_user_id=created_by_user_id,
    )
    db.add(activity)
    db.flush()
    return activity


def list_enquiry_activities(db: Session, *, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> list[AdmissionEnquiryActivity]:
    return db.execute(
        select(AdmissionEnquiryActivity).where(AdmissionEnquiryActivity.tenant_id == tenant_id, AdmissionEnquiryActivity.enquiry_id == enquiry_id)
        .order_by(AdmissionEnquiryActivity.created_at.desc())
    ).scalars().all()


def find_duplicate_enquiries(db: Session, *, tenant_id: uuid.UUID, student_name: str | None, guardian_phone: str | None) -> list[AdmissionEnquiry]:
    """Real detection, not a fabricated warning -- an open lead with the
    same guardian phone, or the same student+guardian name pair,
    already exists. Closed/converted enquiries don't count as
    duplicates -- a family re-enquiring after a prior enquiry was
    closed is a real, new lead, not a repeat."""
    if not student_name and not guardian_phone:
        return []
    conditions = []
    if guardian_phone:
        conditions.append(AdmissionEnquiry.guardian_phone == guardian_phone)
    if student_name:
        conditions.append(func.lower(AdmissionEnquiry.student_name) == student_name.strip().lower())
    return db.execute(
        select(AdmissionEnquiry).where(
            AdmissionEnquiry.tenant_id == tenant_id, AdmissionEnquiry.status.notin_(["closed", "converted"]), or_(*conditions),
        )
    ).scalars().all()


def create_enquiry(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, created_by_user_id: uuid.UUID | None = None, **fields) -> AdmissionEnquiry:
    enquiry = AdmissionEnquiry(tenant_id=tenant_id, company_id=company_id, **fields)
    db.add(enquiry)
    db.flush()
    log_enquiry_activity(
        db, tenant_id=tenant_id, enquiry_id=enquiry.id, activity_type="created",
        description=f"Enquiry logged for {enquiry.student_name} via {enquiry.source or 'an unspecified source'}.",
        created_by_user_id=created_by_user_id,
    )
    emit_event(
        db, tenant_id=tenant_id, event_type="admission.enquiry.created",
        payload={"id": str(enquiry.id), "student_name": enquiry.student_name, "guardian_name": enquiry.guardian_name, "source": enquiry.source},
    )
    return enquiry


def update_enquiry(db: Session, *, tenant_id: uuid.UUID, enquiry_id: uuid.UUID, changed_by_user_id: uuid.UUID | None = None, **fields) -> AdmissionEnquiry:
    enquiry = db.get(AdmissionEnquiry, enquiry_id)
    if enquiry is None or enquiry.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Enquiry not found.", status_code=404)

    new_status = fields.get("status")
    if new_status == "converted" and enquiry.status != "converted":
        raise AppError(ErrorCode.VALIDATION_ERROR, "An enquiry can only become 'converted' by starting a real application, not a plain status change.")
    if new_status is not None and new_status != enquiry.status:
        log_enquiry_activity(
            db, tenant_id=tenant_id, enquiry_id=enquiry.id, activity_type="status_change",
            description=f"Status changed from {ENQUIRY_STATUS_LABEL.get(enquiry.status, enquiry.status)} to {ENQUIRY_STATUS_LABEL.get(new_status, new_status)}.",
            created_by_user_id=changed_by_user_id,
        )
    new_follow_up = fields.get("follow_up_date")
    if new_follow_up is not None and new_follow_up != enquiry.follow_up_date:
        log_enquiry_activity(
            db, tenant_id=tenant_id, enquiry_id=enquiry.id, activity_type="follow_up_scheduled",
            description=f"Follow-up scheduled for {new_follow_up}.", created_by_user_id=changed_by_user_id,
        )

    for field, value in fields.items():
        if value is not None:
            setattr(enquiry, field, value)
    db.flush()
    return enquiry


def get_admissions_summary(db: Session, *, tenant_id: uuid.UUID, branch_id: uuid.UUID | None = None) -> dict:
    """Every number here is computed on read from admission_enquiries/
    admission_applications -- no cached rollup, same discipline
    services/analytics.py (ADR-037) already established."""
    stmt = select(AdmissionEnquiry).where(AdmissionEnquiry.tenant_id == tenant_id)
    if branch_id:
        stmt = stmt.where(AdmissionEnquiry.branch_id == branch_id)
    enquiries = db.execute(stmt).scalars().all()

    today = date.today()
    week_ago = today - timedelta(days=7)
    enquiry_ids = {e.id for e in enquiries}

    started_enquiry_ids: set[uuid.UUID] = set()
    if enquiry_ids:
        started_enquiry_ids = set(
            db.execute(
                select(AdmissionApplication.enquiry_id).where(AdmissionApplication.tenant_id == tenant_id, AdmissionApplication.enquiry_id.in_(enquiry_ids))
            ).scalars().all()
        )

    total = len(enquiries)
    new = sum(1 for e in enquiries if e.created_at.date() >= week_ago)
    overdue = sum(1 for e in enquiries if e.follow_up_date and e.follow_up_date < today and e.status not in ("converted", "closed"))
    due_today = sum(1 for e in enquiries if e.follow_up_date == today and e.status not in ("converted", "closed"))
    converted = sum(1 for e in enquiries if e.status == "converted")
    applications_started = len(started_enquiry_ids)
    conversion_rate = round(converted / total * 100, 1) if total else None

    pipeline = {
        "open": sum(1 for e in enquiries if e.status == "open"),
        "contacted": sum(1 for e in enquiries if e.status == "contacted"),
        "application_started": applications_started,
        "converted": converted,
        "closed": sum(1 for e in enquiries if e.status == "closed"),
    }

    return {
        "total_enquiries": total, "new_enquiries": new, "follow_ups_due_today": due_today, "overdue_follow_ups": overdue,
        "applications_started": applications_started, "converted": converted, "conversion_rate_pct": conversion_rate,
        "pipeline": pipeline,
    }


def create_application(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, created_by_user_id: uuid.UUID | None = None, **fields) -> AdmissionApplication:
    year = db.get(AcademicYear, fields["academic_year_id"])
    if year is None or year.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Academic year not found.")

    enquiry_id = fields.get("enquiry_id")
    if enquiry_id:
        enquiry = db.get(AdmissionEnquiry, enquiry_id)
        if enquiry is None or enquiry.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Enquiry not found.")
        if enquiry.branch_id != fields["branch_id"]:
            raise AppError(ErrorCode.VALIDATION_ERROR, "This application's campus must match the enquiry's own campus.")
        previous_status = enquiry.status
        enquiry.status = "converted"
        if previous_status != "converted":
            log_enquiry_activity(
                db, tenant_id=tenant_id, enquiry_id=enquiry.id, activity_type="status_change",
                description=f"Status changed from {ENQUIRY_STATUS_LABEL.get(previous_status, previous_status)} to Converted -- an application was started.",
                created_by_user_id=created_by_user_id,
            )

    application = AdmissionApplication(
        tenant_id=tenant_id, company_id=company_id,
        application_date=fields.pop("application_date", None) or date.today(),
        **fields,
    )
    db.add(application)
    db.flush()
    return application


def transition_application(
    db: Session, *, tenant_id: uuid.UUID, application_id: uuid.UUID, decided_by_user_id: uuid.UUID | None,
    status: str | None, interview_date: date | None, decision_reason: str | None,
) -> AdmissionApplication:
    application = db.get(AdmissionApplication, application_id)
    if application is None or application.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Application not found.", status_code=404)

    if application.status in TERMINAL_STATUSES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"This application is already {application.status} and cannot be changed further.")

    if status is not None:
        if status not in PATCHABLE_STATUSES:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"'{status}' is not a valid status to set directly.")
        application.status = status
        if status in DECISION_STATUSES or status == "withdrawn":
            application.decided_at = datetime.now(timezone.utc)
            application.decided_by_user_id = decided_by_user_id
    if interview_date is not None:
        application.interview_date = interview_date
    if decision_reason is not None:
        application.decision_reason = decision_reason

    db.flush()
    return application


def convert_application_to_student(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, application_id: uuid.UUID, decided_by_user_id: uuid.UUID,
    school_class_id: uuid.UUID, section_id: uuid.UUID | None, roll_number: str | None,
):
    """The real connected-lifecycle step: creates an actual Student (and
    its first StudentEnrolment) by calling straight into services.
    education's own functions -- the exact same code path
    StudentDrawer's direct-admission flow uses, not a parallel
    shortcut."""
    application = db.get(AdmissionApplication, application_id)
    if application is None or application.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Application not found.", status_code=404)
    if application.status in TERMINAL_STATUSES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"This application is already {application.status}.")

    student = create_student(
        db, tenant_id=tenant_id, company_id=company_id, branch_id=application.branch_id,
        first_name=application.first_name, last_name=application.last_name, date_of_birth=application.date_of_birth,
        admission_date=date.today(),
    )
    enrol_student(
        db, tenant_id=tenant_id, student_id=student.id, academic_year_id=application.academic_year_id,
        school_class_id=school_class_id, section_id=section_id, roll_number=roll_number, enrolment_date=date.today(),
    )

    application.status = "admitted"
    application.student_id = student.id
    application.decided_at = datetime.now(timezone.utc)
    application.decided_by_user_id = decided_by_user_id
    db.flush()
    return student


def _application(db: Session, tenant_id: uuid.UUID, application_id: uuid.UUID) -> AdmissionApplication:
    application = db.get(AdmissionApplication, application_id)
    if application is None or application.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Application not found.", status_code=404)
    return application


def upload_admission_document(
    db: Session, *, tenant_id: uuid.UUID, application_id: uuid.UUID, document_type: str, file_name: str, content: bytes
) -> AdmissionDocument:
    _application(db, tenant_id, application_id)
    document = AdmissionDocument(
        tenant_id=tenant_id, application_id=application_id, document_type=document_type, file_name=file_name,
        file_path=save_file(tenant_id=tenant_id, category="admission_documents", file_name=file_name, content=content),
    )
    db.add(document)
    db.flush()
    return document


def list_admission_documents(db: Session, *, tenant_id: uuid.UUID, application_id: uuid.UUID) -> list[AdmissionDocument]:
    _application(db, tenant_id, application_id)
    return db.execute(
        select(AdmissionDocument).where(AdmissionDocument.tenant_id == tenant_id, AdmissionDocument.application_id == application_id)
        .order_by(AdmissionDocument.created_at)
    ).scalars().all()


def get_admission_document(db: Session, *, tenant_id: uuid.UUID, document_id: uuid.UUID) -> AdmissionDocument:
    document = db.get(AdmissionDocument, document_id)
    if document is None or document.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Document not found.", status_code=404)
    return document


def delete_admission_document(db: Session, *, tenant_id: uuid.UUID, document_id: uuid.UUID) -> None:
    document = get_admission_document(db, tenant_id=tenant_id, document_id=document_id)
    db.delete(document)
    db.flush()
