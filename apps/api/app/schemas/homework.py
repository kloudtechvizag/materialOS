import uuid
from datetime import date

from pydantic import BaseModel


class HomeworkOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID
    title: str
    description: str | None
    assigned_date: date
    due_date: date
    attachment_file_name: str | None

    class Config:
        from_attributes = True


class HomeworkCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    title: str
    description: str | None = None
    assigned_date: date
    due_date: date


class HomeworkUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None


class HomeworkSubmissionRow(BaseModel):
    student_id: uuid.UUID
    status: str
    remarks: str | None = None


class HomeworkSubmissionsBulkUpsert(BaseModel):
    records: list[HomeworkSubmissionRow]


class HomeworkSubmissionOut(BaseModel):
    id: uuid.UUID
    homework_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    submitted_date: date | None
    remarks: str | None

    class Config:
        from_attributes = True


class HomeworkRosterEntryOut(BaseModel):
    student_id: uuid.UUID
    first_name: str
    last_name: str
    roll_number: str | None
    status: str
    submitted_date: date | None
    remarks: str | None


class StudentHomeworkEntryOut(BaseModel):
    homework: HomeworkOut
    status: str
