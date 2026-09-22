import uuid
from datetime import date

from pydantic import BaseModel


class AcademicYearOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    is_current: bool

    class Config:
        from_attributes = True


class AcademicYearCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False


class SchoolClassOut(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    sequence: int
    is_active: bool

    class Config:
        from_attributes = True


class SchoolClassCreate(BaseModel):
    academic_year_id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    sequence: int = 0


class SectionOut(BaseModel):
    id: uuid.UUID
    school_class_id: uuid.UUID
    name: str
    capacity: int | None
    class_teacher_id: uuid.UUID | None
    is_active: bool

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    school_class_id: uuid.UUID
    name: str
    capacity: int | None = None
    class_teacher_id: uuid.UUID | None = None


class GuardianOut(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str | None
    email: str | None
    occupation: str | None
    address_line1: str | None
    city: str | None
    state: str | None
    pincode: str | None

    class Config:
        from_attributes = True


class GuardianCreate(BaseModel):
    full_name: str
    phone: str | None = None
    email: str | None = None
    occupation: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None


class GuardianPortalAccessCreate(BaseModel):
    email: str
    password: str
    full_name: str


class GuardianPortalAccessOut(BaseModel):
    user_id: uuid.UUID
    email: str
    guardian_id: uuid.UUID


class StudentGuardianOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    guardian_id: uuid.UUID
    relationship_type: str
    is_primary_contact: bool

    class Config:
        from_attributes = True


class StudentGuardianLink(BaseModel):
    guardian_id: uuid.UUID
    relationship_type: str
    is_primary_contact: bool = False


class StudentEnrolmentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    academic_year_id: uuid.UUID
    school_class_id: uuid.UUID
    section_id: uuid.UUID | None
    roll_number: str | None
    enrolment_date: date
    status: str

    class Config:
        from_attributes = True


class StudentEnrolmentCreate(BaseModel):
    academic_year_id: uuid.UUID
    school_class_id: uuid.UUID
    section_id: uuid.UUID | None = None
    roll_number: str | None = None
    enrolment_date: date | None = None


class StudentOut(BaseModel):
    id: uuid.UUID
    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None
    gender: str | None
    blood_group: str | None
    phone: str | None
    email: str | None
    address_line1: str | None
    city: str | None
    state: str | None
    pincode: str | None
    previous_school: str | None
    admission_date: date
    category: str | None
    status: str
    company_id: uuid.UUID
    branch_id: uuid.UUID

    class Config:
        from_attributes = True


class StudentCreate(BaseModel):
    branch_id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    phone: str | None = None
    email: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    previous_school: str | None = None
    admission_date: date
    category: str | None = None
    # Optional -- a student can be created without an immediate
    # enrolment (spec's own "do not require every module to be
    # configured before the school can start using the system"). When
    # provided, one StudentEnrolment row is created atomically.
    academic_year_id: uuid.UUID | None = None
    school_class_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    roll_number: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    phone: str | None = None
    email: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    previous_school: str | None = None
    category: str | None = None
    status: str | None = None
