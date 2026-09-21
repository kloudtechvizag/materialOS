import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Section, SchoolClass
from app.models.hr import Employee
from app.models.timetable import Subject, TimetableEntry, TimetableSlot


def create_subject(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str, code: str) -> Subject:
    subject = Subject(tenant_id=tenant_id, company_id=company_id, name=name, code=code)
    db.add(subject)
    db.flush()
    return subject


def update_subject(db: Session, *, tenant_id: uuid.UUID, subject_id: uuid.UUID, **fields) -> Subject:
    subject = db.get(Subject, subject_id)
    if subject is None or subject.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Subject not found.", status_code=404)
    for key, value in fields.items():
        if value is not None:
            setattr(subject, key, value)
    db.flush()
    return subject


def create_slot(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str, sequence: int, start_time, end_time, is_break: bool
) -> TimetableSlot:
    if end_time <= start_time:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Slot end time must be after its start time.")
    slot = TimetableSlot(
        tenant_id=tenant_id, company_id=company_id, name=name, sequence=sequence,
        start_time=start_time, end_time=end_time, is_break=is_break,
    )
    db.add(slot)
    db.flush()
    return slot


def _section(db: Session, tenant_id: uuid.UUID, section_id: uuid.UUID) -> Section:
    section = db.get(Section, section_id)
    if section is None or section.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Section not found.")
    return section


def get_section_timetable(db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID) -> list[TimetableEntry]:
    _section(db, tenant_id, section_id)
    return db.execute(
        select(TimetableEntry).where(TimetableEntry.tenant_id == tenant_id, TimetableEntry.section_id == section_id)
    ).scalars().all()


def upsert_timetable_entry(
    db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID, day_of_week: int, slot_id: uuid.UUID,
    subject_id: uuid.UUID, teacher_id: uuid.UUID | None, room: str | None,
) -> TimetableEntry:
    _section(db, tenant_id, section_id)

    slot = db.get(TimetableSlot, slot_id)
    if slot is None or slot.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Timetable slot not found.")
    if slot.is_break:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Cannot schedule a subject into a break slot.")

    subject = db.get(Subject, subject_id)
    if subject is None or subject.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Subject not found.")

    existing = db.execute(
        select(TimetableEntry).where(
            TimetableEntry.tenant_id == tenant_id,
            TimetableEntry.section_id == section_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.slot_id == slot_id,
        )
    ).scalar_one_or_none()

    if teacher_id is not None:
        employee = db.get(Employee, teacher_id)
        if employee is None or employee.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Teacher not found.")

        clash_stmt = select(TimetableEntry).where(
            TimetableEntry.tenant_id == tenant_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.slot_id == slot_id,
            TimetableEntry.teacher_id == teacher_id,
        )
        if existing is not None:
            clash_stmt = clash_stmt.where(TimetableEntry.id != existing.id)
        clash = db.execute(clash_stmt).scalar_one_or_none()
        if clash is not None:
            clash_section = db.get(Section, clash.section_id)
            raise AppError(
                ErrorCode.CONFLICT,
                f"{employee.first_name} {employee.last_name} is already scheduled for this period"
                f" in section {clash_section.name if clash_section else clash.section_id}.",
                status_code=409,
            )

    if existing is not None:
        existing.subject_id = subject_id
        existing.teacher_id = teacher_id
        existing.room = room
        db.flush()
        return existing

    entry = TimetableEntry(
        tenant_id=tenant_id, section_id=section_id, day_of_week=day_of_week, slot_id=slot_id,
        subject_id=subject_id, teacher_id=teacher_id, room=room,
    )
    db.add(entry)
    db.flush()
    return entry


def delete_timetable_entry(db: Session, *, tenant_id: uuid.UUID, entry_id: uuid.UUID) -> None:
    entry = db.get(TimetableEntry, entry_id)
    if entry is None or entry.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Timetable entry not found.", status_code=404)
    db.delete(entry)
    db.flush()


def get_teacher_schedule(db: Session, *, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[dict]:
    rows = db.execute(
        select(TimetableEntry, Section, SchoolClass, Subject)
        .join(Section, Section.id == TimetableEntry.section_id)
        .join(SchoolClass, SchoolClass.id == Section.school_class_id)
        .join(Subject, Subject.id == TimetableEntry.subject_id)
        .where(TimetableEntry.tenant_id == tenant_id, TimetableEntry.teacher_id == teacher_id)
        .order_by(TimetableEntry.day_of_week)
    ).all()

    return [
        {
            "id": entry.id, "day_of_week": entry.day_of_week, "slot_id": entry.slot_id, "section_id": entry.section_id,
            "school_class_name": school_class.name, "section_name": section.name, "subject_name": subject.name, "room": entry.room,
        }
        for entry, section, school_class, subject in rows
    ]
