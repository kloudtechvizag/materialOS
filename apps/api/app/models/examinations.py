"""Examinations & Report Cards (spec sec13/14) -- built on the real
Subject master from Timetable (ADR-028) and the real Student/
StudentEnrolment foundations from ADR-025, rather than parallel
entities.

Deliberately NOT built in this pass (named, not faked): a configurable
grading-scale master (grade bands are computed, not per-school
configuration -- see services/examinations.py), class rank / merit
list computation, co-scholastic/skill-based (non-marks) assessment
areas, and report card PDF export.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MARKS = Numeric(6, 2)


class Examination(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "examinations"
    __table_args__ = (UniqueConstraint("tenant_id", "academic_year_id", "name", name="uq_examinations_year_name"),)

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # "Mid Term 1", "Annual Exam"
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Once locked, marks entry is rejected (PERIOD_LOCKED, same error
    # code/reasoning as FinancialYear locking in services/numbering.py)
    # -- a report card should not silently drift after it's been
    # handed out. Unlock is a real, permission-gated action, not a
    # one-way door.
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ExamSubjectSchedule(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Which subjects this examination covers for a given class, and
    the max/pass marks for that combination -- a class's Hindi paper
    and its Math paper legitimately have different max marks."""

    __tablename__ = "exam_subject_schedules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "examination_id", "school_class_id", "subject_id", name="uq_exam_subject_schedule"),
    )

    examination_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    school_class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_marks: Mapped[Decimal] = mapped_column(MARKS, nullable=False, default=100)
    pass_marks: Mapped[Decimal] = mapped_column(MARKS, nullable=False, default=33)


class ExamMark(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "exam_marks"
    __table_args__ = (
        UniqueConstraint("tenant_id", "exam_subject_schedule_id", "student_id", name="uq_exam_marks_student"),
    )

    exam_subject_schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_subject_schedules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Null when is_absent -- a real absence, not a fabricated zero that
    # would silently count against the class average the same way a
    # genuine zero score does.
    marks_obtained: Mapped[Decimal | None] = mapped_column(MARKS, nullable=True)
    is_absent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    remarks: Mapped[str | None] = mapped_column(String(300), nullable=True)
