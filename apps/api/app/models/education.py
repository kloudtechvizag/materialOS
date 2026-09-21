"""School Management (industry #26) -- the foundational Student
Information System everything else in the education vertical depends
on (admissions convert into a Student, attendance/fees/exams are all
marked against one). Deliberately NOT built in this pass (named, not
faked): AcademicTerm, admissions CRM, attendance, fees, examinations,
timetables, the parent/student portal, and multi-campus School/Campus
entities -- a single-school tenant's existing Company already plays
the role of "the school" (see ADR docstring), so no separate School
model was introduced.

**Enrolment, not a current-class column on Student.** The spec itself
is explicit: "do not overwrite a student's previous academic history
when promoting." A student's class/section for a given academic year
lives on its own `StudentEnrolment` row (one per student per year, via
its own unique constraint) rather than as a mutable column on Student
-- promoting a student to next year is a new row, not an update to the
same one. Within a year, a section transfer *does* update that year's
own enrolment row in place (no separate per-transfer history table
yet) -- a real, named scope limit, not a hidden one.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class AcademicYear(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "academic_years"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "name", name="uq_academic_years_company_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False)  # "2026-27"
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Exactly one per company should be true at a time -- enforced in
    # services/education.py (flips the old year off in the same
    # transaction), not a DB constraint; a real rollover workflow that
    # flips this atomically at year-end is a separate, later slice.
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class SchoolClass(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "school_classes"
    __table_args__ = (UniqueConstraint("tenant_id", "academic_year_id", "name", name="uq_school_classes_year_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # "Grade 5", "Class X"
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Section(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "sections"
    __table_args__ = (UniqueConstraint("tenant_id", "school_class_id", "name", name="uq_sections_class_name"),)

    school_class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False)  # "A", "B"
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Reuses the existing HR Employee model (spec sec2's own "reuse...
    # user and employee foundations") rather than a parallel Teacher
    # entity -- a class teacher IS an Employee.
    class_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Guardian(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "guardians"

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Nullable, real self-service linkage point for the eventual Parent
    # Portal (not built this pass) -- same "not every record needs a
    # login; link it when self-service actually activates" pattern as
    # Employee.user_id (models/hr.py).
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Nullable, same lazy-link pattern as user_id above -- a real
    # Customer row (billing party) created only when fee invoicing
    # actually happens for this guardian (services/fees.py), not
    # speculatively for every guardian on creation.
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )


class Student(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("tenant_id", "admission_number", name="uq_students_admission_number"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    admission_number: Mapped[str] = mapped_column(String(30), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(String(200), nullable=True)
    admission_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Free text, not an enum -- school-specific categories (spec's own
    # "Category and applicable school-specific fields" -- do not
    # hardcode one school's policy) are configuration, not code.
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # active|transferred|withdrawn|alumni|inactive -- overall student
    # lifecycle, distinct from any one year's StudentEnrolment.status.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")


class StudentGuardian(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "student_guardians"
    __table_args__ = (UniqueConstraint("tenant_id", "student_id", "guardian_id", name="uq_student_guardians_pair"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    guardian_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # On the join, not on Guardian itself -- the same guardian record
    # (e.g. one parent) can legitimately be linked to more than one
    # student (siblings) without implying the same relationship label
    # for both.
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False)  # father|mother|guardian|other
    is_primary_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class StudentEnrolment(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "student_enrolments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "academic_year_id", name="uq_student_enrolments_year"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    school_class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    roll_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    enrolment_date: Mapped[date] = mapped_column(Date, nullable=False)
    # active|transferred|withdrawn|promoted|repeated -- this ONE year's
    # outcome; never overwritten when the student moves to the next
    # year's own new StudentEnrolment row (see module docstring).
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
