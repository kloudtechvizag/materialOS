import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.admissions import AdmissionApplication, AdmissionEnquiry
from app.models.education import AcademicYear
from app.services.education import create_student, enrol_student
from app.services.webhooks import emit_event

TERMINAL_STATUSES = {"admitted", "rejected", "withdrawn"}
# "admitted" is deliberately excluded -- it's only ever reached through
# convert_application_to_student, which creates the real Student atomically.
# Setting it via a plain status PATCH would let an application read
# "admitted" with no student_id behind it.
PATCHABLE_STATUSES = {"under_review", "interview_scheduled", "interviewed", "offered", "waitlisted", "rejected", "withdrawn"}
DECISION_STATUSES = {"offered", "waitlisted", "rejected"}


def create_enquiry(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, **fields) -> AdmissionEnquiry:
    enquiry = AdmissionEnquiry(tenant_id=tenant_id, company_id=company_id, **fields)
    db.add(enquiry)
    db.flush()
    emit_event(
        db, tenant_id=tenant_id, event_type="admission.enquiry.created",
        payload={"id": str(enquiry.id), "student_name": enquiry.student_name, "guardian_name": enquiry.guardian_name, "source": enquiry.source},
    )
    return enquiry


def update_enquiry(db: Session, *, tenant_id: uuid.UUID, enquiry_id: uuid.UUID, **fields) -> AdmissionEnquiry:
    enquiry = db.get(AdmissionEnquiry, enquiry_id)
    if enquiry is None or enquiry.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Enquiry not found.", status_code=404)
    for field, value in fields.items():
        if value is not None:
            setattr(enquiry, field, value)
    db.flush()
    return enquiry


def create_application(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, **fields) -> AdmissionApplication:
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
        enquiry.status = "converted"

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
