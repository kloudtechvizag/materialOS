import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AdmissionEnquiryOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    student_name: str
    date_of_birth: date | None
    desired_grade: str | None
    guardian_name: str
    guardian_phone: str | None
    guardian_email: str | None
    source: str | None
    status: str
    follow_up_date: date | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AdmissionEnquiryCreate(BaseModel):
    branch_id: uuid.UUID
    student_name: str
    date_of_birth: date | None = None
    desired_grade: str | None = None
    guardian_name: str
    guardian_phone: str | None = None
    guardian_email: str | None = None
    source: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None


class AdmissionEnquiryUpdate(BaseModel):
    status: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None


class AdmissionApplicationOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    enquiry_id: uuid.UUID | None
    first_name: str
    last_name: str
    date_of_birth: date | None
    desired_grade: str | None
    academic_year_id: uuid.UUID
    guardian_name: str
    guardian_phone: str | None
    guardian_email: str | None
    application_date: date
    status: str
    interview_date: date | None
    decision_reason: str | None
    decided_at: datetime | None
    student_id: uuid.UUID | None

    class Config:
        from_attributes = True


class AdmissionApplicationCreate(BaseModel):
    branch_id: uuid.UUID
    enquiry_id: uuid.UUID | None = None
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    desired_grade: str | None = None
    academic_year_id: uuid.UUID
    guardian_name: str
    guardian_phone: str | None = None
    guardian_email: str | None = None
    application_date: date | None = None


class AdmissionApplicationUpdate(BaseModel):
    status: str | None = None
    interview_date: date | None = None
    decision_reason: str | None = None


class AdmissionDocumentOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    document_type: str
    file_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdmissionConvertRequest(BaseModel):
    school_class_id: uuid.UUID
    section_id: uuid.UUID | None = None
    roll_number: str | None = None
