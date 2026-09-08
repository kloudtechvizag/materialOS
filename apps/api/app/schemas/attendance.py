import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AttendanceRecordOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date
    clock_in_at: datetime | None
    clock_out_at: datetime | None
    status: str
    method: str
    worked_minutes: int
    late_minutes: int
    overtime_minutes: int

    class Config:
        from_attributes = True


class CorrectionRequestCreate(BaseModel):
    attendance_date: date
    requested_clock_in: datetime | None = None
    requested_clock_out: datetime | None = None
    reason: str


class CorrectionReviewRequest(BaseModel):
    approve: bool
    review_notes: str | None = None


class AttendanceCorrectionOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date
    requested_clock_in: datetime | None
    requested_clock_out: datetime | None
    reason: str
    status: str
    reviewed_at: datetime | None
    review_notes: str | None

    class Config:
        from_attributes = True
