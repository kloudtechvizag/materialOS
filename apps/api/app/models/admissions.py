"""Admissions CRM (spec sec7) -- the funnel that feeds the SIS built in
ADR-025: Enquiry -> Application -> Decision -> real Student +
Enrolment (services/admissions.py::convert_application_to_student
calls straight into services/education.py's own create_student/
enrol_student, not a parallel implementation).

Deliberately NOT built this pass (named, not faked): a public-facing
enquiry/application web form, interview *scheduling* (an
`interview_date` field is real; a calendar/availability system is
not), seat-capacity/waitlist-ranking automation (SchoolClass has no
capacity field yet), and admission-fee collection (depends on the
not-yet-built Fee Management module, Phase 4).

**Document upload (ADR-041)** reuses `app.storage`'s `save_file`/
`read_file` convention -- `AdmissionDocument` is a real one-to-many
table (a birth certificate, a transfer certificate, and a photo are
three separate real files for one application), not a single path
column like `Homework.attachment_path`, since an application
genuinely needs more than one document at once.

**Admissions CRM workspace (ADR-045)**: `AdmissionEnquiry.
assigned_to_id` reuses the core `Employee` model for "assigned
counsellor" -- same reasoning as `Section.class_teacher_id`, a
counsellor IS an employee, not a parallel staff entity.
`AdmissionEnquiryActivity` is a real, small, append-only log (call
logged, note added, status changed, follow-up scheduled) -- the
`notes` field above stays a single current-state field; an honest
multi-entry activity timeline needed its own table rather than
pretending one field's edit history was a timeline.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class AdmissionEnquiry(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "admission_enquiries"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Which campus this family is enquiring about (ADR-038's
    # multi-campus retrofit) -- a real routing fact, not metadata; a
    # front-office staffer at one campus shouldn't have to sift through
    # every other campus's leads to find their own.
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    student_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Free text, not a SchoolClass FK -- an enquiry routinely predates
    # the target academic year's classes even existing yet.
    desired_grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guardian_name: Mapped[str] = mapped_column(String(200), nullable=False)
    guardian_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "Walk-in", "Website", "Referral", ...
    # open|contacted|converted|closed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )


class AdmissionApplication(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "admission_applications"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Which campus this application targets -- when converted from an
    # enquiry it must match that enquiry's own branch_id (see
    # services/admissions.py::create_application); a fresh application
    # taken directly still requires it.
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admission_enquiries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    desired_grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    guardian_name: Mapped[str] = mapped_column(String(200), nullable=False)
    guardian_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    # submitted -> under_review -> interview_scheduled -> interviewed ->
    # offered | waitlisted | rejected -> admitted | withdrawn.
    # "admitted" is only ever set by services.admissions.
    # convert_application_to_student (never a plain status PATCH), so an
    # application can never read "admitted" without a real student_id.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    interview_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )


class AdmissionDocument(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "admission_documents"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admission_applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Free text, not an enum -- "Birth Certificate", "Transfer
    # Certificate", "Photo", "Previous Report Card"... school-specific
    # requirements, same reasoning as Student.category (ADR-025).
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)


ENQUIRY_ACTIVITY_TYPES = ["note", "call", "status_change", "follow_up_scheduled", "created"]


class AdmissionEnquiryActivity(Base, UUIDPk, TenantMixin, TimestampMixin):
    """The real activity timeline for one enquiry. `created` and
    `status_change` rows are written automatically by services.
    admissions itself (create_enquiry / update_enquiry) so the timeline
    is populated from the moment an enquiry exists, not only once staff
    starts manually logging things -- `note`/`call`/
    `follow_up_scheduled` are the staff-initiated entries."""

    __tablename__ = "admission_enquiry_activities"

    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admission_enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
