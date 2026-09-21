"""Hostel (Phase 6, spec sec19): hostel buildings, rooms, and per-year
bed allocation. `warden_id` reuses the existing core `Employee` model
(models/hr.py) directly -- same reasoning as `Section.class_teacher_id`
(ADR-025) and Transport's `driver_id` (ADR-034): a warden IS an
employee, not a parallel staff entity.

Deliberately NOT built in this pass (named, not faked): mess/meal
attendance tracking and leave/outpass management for boarders -- both
are real, separate features this slice doesn't attempt to fake with a
half-built table.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

HOSTEL_TYPES = ["boys", "girls", "co_ed"]


class Hostel(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "hostels"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    hostel_type: Mapped[str] = mapped_column(String(20), nullable=False, default="co_ed")
    warden_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HostelRoom(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "hostel_rooms"
    __table_args__ = (UniqueConstraint("tenant_id", "hostel_id", "room_number", name="uq_hostel_rooms_number"),)

    hostel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hostels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    floor: Mapped[str | None] = mapped_column(String(20), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class StudentHostelAllocation(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One row per student per academic year -- same "history is never
    silently overwritten" reasoning as StudentEnrolment (ADR-025) and
    StudentTransportAssignment (ADR-034): re-allocating within the
    same year updates that year's row in place. A specific bed within
    a room is also guaranteed unique for that year, so two students
    can never be allocated the same bed at once."""

    __tablename__ = "student_hostel_allocations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "academic_year_id", name="uq_student_hostel_year"),
        UniqueConstraint("tenant_id", "room_id", "bed_number", "academic_year_id", name="uq_hostel_bed_year"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hostel_rooms.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    bed_number: Mapped[int] = mapped_column(Integer, nullable=False)
