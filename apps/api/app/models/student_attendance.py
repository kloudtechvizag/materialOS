"""Student attendance (spec sec11) -- a deliberately separate domain
from employee attendance (models/attendance.py's own AttendanceRecord,
ADR-015): the spec is explicit ("keep student attendance and employee
attendance as separate domain workflows"), and the shapes genuinely
differ -- a student's day is present/absent/late/half-day/excused, not
clock-in/clock-out/worked-minutes.

Daily granularity only this pass (one row per student per day, not
period-wise) -- period-wise attendance needs a real Timetable to mark
against, which is a separate, not-yet-built slice (see ADR-026's own
"deliberately not built" precedent for naming a real dependency rather
than faking it).
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

STUDENT_ATTENDANCE_STATUSES = ["present", "absent", "late", "half_day", "excused", "on_leave"]


class StudentAttendanceRecord(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "student_attendance_records"
    __table_args__ = (UniqueConstraint("tenant_id", "student_id", "attendance_date", name="uq_student_attendance_record_date"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Snapshotted from the student's enrolment at mark time, not
    # resolved live from "current" enrolment -- so a year-old
    # attendance record still correctly shows the class/section the
    # student was actually in on that date, even after a later
    # promotion or section transfer.
    school_class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="present")
    marked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    remarks: Mapped[str | None] = mapped_column(String(300), nullable=True)
