import uuid
from datetime import time

from pydantic import BaseModel


class SubjectOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    is_active: bool

    class Config:
        from_attributes = True


class SubjectCreate(BaseModel):
    name: str
    code: str


class SubjectUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class TimetableSlotOut(BaseModel):
    id: uuid.UUID
    name: str
    sequence: int
    start_time: time
    end_time: time
    is_break: bool

    class Config:
        from_attributes = True


class TimetableSlotCreate(BaseModel):
    name: str
    sequence: int
    start_time: time
    end_time: time
    is_break: bool = False


class TimetableEntryOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    day_of_week: int
    slot_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID | None
    room: str | None

    class Config:
        from_attributes = True


class TimetableEntryUpsert(BaseModel):
    section_id: uuid.UUID
    day_of_week: int
    slot_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID | None = None
    room: str | None = None


class TeacherScheduleEntryOut(BaseModel):
    """Denormalized for a teacher's own weekly view -- carries the
    class/section/subject names directly since the caller has no
    other reason to be fetching those masters separately."""

    id: uuid.UUID
    day_of_week: int
    slot_id: uuid.UUID
    section_id: uuid.UUID
    school_class_name: str
    section_name: str
    subject_name: str
    room: str | None

    class Config:
        from_attributes = True
