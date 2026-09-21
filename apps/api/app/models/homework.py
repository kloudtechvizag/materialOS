"""Homework & Assignments (spec sec15) -- built on the real Section
and Subject masters from ADR-025/ADR-028.

Deliberately NOT built in this pass (named, not faked): student/parent
self-service submission (no portal exists yet -- Phase 5), file
attachments, and grading/marks integration with Examinations. Staff
mark submission status themselves (the same "no portal yet, so the
staff-facing roster IS the real workflow" reasoning ADR-027's
attendance and ADR-029's marks entry already established), which is
real, usable functionality even without a student-facing counterpart.
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

HOMEWORK_SUBMISSION_STATUSES = ["pending", "submitted", "late", "missing"]


class Homework(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "homework"

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class HomeworkSubmission(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "homework_submissions"
    __table_args__ = (UniqueConstraint("tenant_id", "homework_id", "student_id", name="uq_homework_submissions_student"),)

    homework_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("homework.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    submitted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(300), nullable=True)
