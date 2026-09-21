import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ExaminationOut(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    is_locked: bool

    class Config:
        from_attributes = True


class ExaminationCreate(BaseModel):
    academic_year_id: uuid.UUID
    name: str
    start_date: date
    end_date: date


class ExaminationUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class ExamSubjectScheduleOut(BaseModel):
    id: uuid.UUID
    examination_id: uuid.UUID
    school_class_id: uuid.UUID
    subject_id: uuid.UUID
    exam_date: date | None
    max_marks: Decimal
    pass_marks: Decimal

    class Config:
        from_attributes = True


class ExamSubjectScheduleCreate(BaseModel):
    school_class_id: uuid.UUID
    subject_id: uuid.UUID
    exam_date: date | None = None
    max_marks: Decimal = Decimal(100)
    pass_marks: Decimal = Decimal(33)


class ExamMarkRow(BaseModel):
    student_id: uuid.UUID
    marks_obtained: Decimal | None = None
    is_absent: bool = False
    remarks: str | None = None


class ExamMarksBulkUpsert(BaseModel):
    records: list[ExamMarkRow]


class ExamMarkOut(BaseModel):
    id: uuid.UUID
    exam_subject_schedule_id: uuid.UUID
    student_id: uuid.UUID
    marks_obtained: Decimal | None
    is_absent: bool
    remarks: str | None

    class Config:
        from_attributes = True


class ExamRosterEntryOut(BaseModel):
    student_id: uuid.UUID
    first_name: str
    last_name: str
    roll_number: str | None
    marks_obtained: Decimal | None
    is_absent: bool
    remarks: str | None


class ReportCardSubjectOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    max_marks: Decimal
    pass_marks: Decimal
    marks_obtained: Decimal | None
    is_absent: bool
    is_pass: bool | None
    grade: str | None


class ReportCardOut(BaseModel):
    student_id: uuid.UUID
    examination_id: uuid.UUID
    examination_name: str
    subjects: list[ReportCardSubjectOut]
    total_marks_obtained: Decimal
    total_max_marks: Decimal
    percentage: Decimal | None
    overall_grade: str | None
    overall_result: str  # pass | fail | incomplete
