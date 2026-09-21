"""Timetable & Scheduling (spec sec10) -- weekly class/section
schedules, built on the real Section/Employee foundations from
ADR-025/HR rather than parallel Teacher/Class entities.

Deliberately NOT built in this pass (named, not faked): substitute
teacher assignment for a specific date (needs a real staff-leave
trigger to hang off), a Room/resource master with capacity/clash
checking (rooms are a free-text field here, not a real entity),
published/draft timetable versioning, and student-facing "my
timetable" notifications (Communication Center, Phase 5).
"""

import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Subject(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_subjects_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class TimetableSlot(Base, UUIDPk, TenantMixin, TimestampMixin):
    """The school's daily period grid -- one shared set of slots (not
    per class/section), matching how a real school bell schedule works.
    A slot with is_break=True (recess, lunch) is shown on the grid but
    never carries a TimetableEntry."""

    __tablename__ = "timetable_slots"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "sequence", name="uq_timetable_slots_company_sequence"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # "Period 1", "Lunch"
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_break: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TimetableEntry(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One (section, day-of-week, slot) cell. Uniqueness prevents a
    section from being double-booked for the same period; the teacher
    double-booking check (one teacher can't be in two sections at the
    same slot) is real but is service-level logic
    (services/timetable.py), not expressible as a single-table unique
    constraint since teacher_id isn't part of this table's own key."""

    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "section_id", "day_of_week", "slot_id", name="uq_timetable_entries_cell"),
    )

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 0=Monday .. 6=Sunday (ISO weekday - 1), consistent regardless of
    # which days a given school actually holds classes.
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_slots.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Reuses the existing HR Employee model, same reasoning as
    # Section.class_teacher_id (models/education.py) -- a subject
    # teacher IS an Employee, not a parallel Teacher entity.
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)
