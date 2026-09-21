import uuid
from datetime import date

from pydantic import BaseModel


class StudentAttendanceRecordOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    school_class_id: uuid.UUID
    section_id: uuid.UUID | None
    attendance_date: date
    status: str
    remarks: str | None

    class Config:
        from_attributes = True


class RosterEntryOut(BaseModel):
    student_id: uuid.UUID
    first_name: str
    last_name: str
    roll_number: str | None
    status: str | None  # null if not yet marked for this date


class MarkAttendanceRow(BaseModel):
    student_id: uuid.UUID
    status: str
    remarks: str | None = None


class BulkMarkRequest(BaseModel):
    section_id: uuid.UUID
    attendance_date: date
    records: list[MarkAttendanceRow]
