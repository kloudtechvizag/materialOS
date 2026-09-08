"""ADR-015: one row per employee per calendar day, upserted by clock-in
/clock-out (spec sec15-25). `method` records how the punch was made
(manual/web/mobile -- see services/attendance.py's
AttendanceDeviceProvider docstring for why biometric/QR aren't real
implementations yet, just a documented adapter shape).
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

ATTENDANCE_STATUSES = [
    "present", "absent", "late", "half_day", "on_leave", "holiday", "weekly_off", "missing_punch",
]


class AttendanceRecord(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("tenant_id", "employee_id", "attendance_date", name="uq_attendance_employee_date"),)

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    clock_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clock_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="present")
    method: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # manual|web|mobile
    worked_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    late_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class AttendanceCorrection(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "attendance_corrections"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_clock_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|approved|rejected
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
