import uuid

from pydantic import BaseModel


class ChildSummaryOut(BaseModel):
    """Denormalized (class/section names, not just ids) -- guardian-
    portal accounts carry no RBAC permissions, so they can't call the
    generic staff /school-classes or /sections endpoints to resolve
    names themselves the way the internal dashboard does."""

    student_id: uuid.UUID
    first_name: str
    last_name: str
    admission_number: str
    relationship_type: str
    school_class_id: uuid.UUID | None
    school_class_name: str | None
    section_id: uuid.UUID | None
    section_name: str | None


class ChildTimetableEntryOut(BaseModel):
    """Same denormalization reasoning as ChildSummaryOut -- a guardian
    can't call the staff /subjects or /timetable-slots endpoints to
    resolve names themselves."""

    day_of_week: int
    slot_name: str
    start_time: str
    end_time: str
    subject_name: str
    room: str | None
