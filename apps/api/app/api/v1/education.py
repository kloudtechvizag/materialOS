import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.education import AcademicYear, Guardian, SchoolClass, Section, Student, StudentEnrolment, StudentGuardian
from app.models.tenant import Company
from app.models.user import User
from app.schemas.education import (
    AcademicYearCreate,
    AcademicYearOut,
    GuardianCreate,
    GuardianOut,
    SchoolClassCreate,
    SchoolClassOut,
    SectionCreate,
    SectionOut,
    StudentCreate,
    StudentEnrolmentCreate,
    StudentEnrolmentOut,
    StudentGuardianLink,
    StudentGuardianOut,
    StudentOut,
    StudentUpdate,
)
from app.services.education import create_academic_year, create_guardian, create_school_class, create_section, create_student, enrol_student, link_guardian

router = APIRouter(tags=["education"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


# ------------------------------------------------------------- Academic years

@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_academic_years(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("academic_years.view"))) -> list[AcademicYear]:
    return db.execute(select(AcademicYear).order_by(AcademicYear.start_date.desc())).scalars().all()


@router.post("/academic-years", response_model=AcademicYearOut, status_code=201)
def create_academic_year_endpoint(
    payload: AcademicYearCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("academic_years.create"))
) -> AcademicYear:
    company = _company(db, user.tenant_id)
    return create_academic_year(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


# --------------------------------------------------------------- School classes

@router.get("/school-classes", response_model=list[SchoolClassOut])
def list_school_classes(
    academic_year_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("school_classes.view"))
) -> list[SchoolClass]:
    stmt = select(SchoolClass).order_by(SchoolClass.sequence, SchoolClass.name)
    if academic_year_id:
        stmt = stmt.where(SchoolClass.academic_year_id == academic_year_id)
    return db.execute(stmt).scalars().all()


@router.post("/school-classes", response_model=SchoolClassOut, status_code=201)
def create_school_class_endpoint(
    payload: SchoolClassCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("school_classes.create"))
) -> SchoolClass:
    company = _company(db, user.tenant_id)
    return create_school_class(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


# --------------------------------------------------------------------- Sections

@router.get("/sections", response_model=list[SectionOut])
def list_sections(
    school_class_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("school_classes.view"))
) -> list[Section]:
    stmt = select(Section).order_by(Section.name)
    if school_class_id:
        stmt = stmt.where(Section.school_class_id == school_class_id)
    return db.execute(stmt).scalars().all()


@router.post("/sections", response_model=SectionOut, status_code=201)
def create_section_endpoint(
    payload: SectionCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("school_classes.create"))
) -> Section:
    return create_section(db, tenant_id=user.tenant_id, **payload.model_dump())


# -------------------------------------------------------------------- Guardians

@router.get("/guardians", response_model=list[GuardianOut])
def list_guardians(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("guardians.view"))) -> list[Guardian]:
    return db.execute(select(Guardian).order_by(Guardian.full_name)).scalars().all()


@router.post("/guardians", response_model=GuardianOut, status_code=201)
def create_guardian_endpoint(
    payload: GuardianCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("guardians.create"))
) -> Guardian:
    return create_guardian(db, tenant_id=user.tenant_id, **payload.model_dump())


# --------------------------------------------------------------------- Students

@router.get("/students", response_model=list[StudentOut])
def list_students(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("students.view"))) -> list[Student]:
    return db.execute(select(Student).order_by(Student.admission_number)).scalars().all()


@router.get("/students/{student_id}", response_model=StudentOut)
def get_student(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("students.view"))) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise AppError(ErrorCode.NOT_FOUND, "Student not found.", status_code=404)
    return student


@router.post("/students", response_model=StudentOut, status_code=201)
def create_student_endpoint(
    payload: StudentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("students.create"))
) -> Student:
    company = _company(db, user.tenant_id)
    return create_student(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.patch("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: uuid.UUID, payload: StudentUpdate, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("students.edit"))
) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise AppError(ErrorCode.NOT_FOUND, "Student not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.flush()
    return student


@router.get("/students/{student_id}/guardians", response_model=list[StudentGuardianOut])
def list_student_guardians(
    student_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("students.view"))
) -> list[StudentGuardian]:
    return db.execute(select(StudentGuardian).where(StudentGuardian.student_id == student_id)).scalars().all()


@router.post("/students/{student_id}/guardians", response_model=StudentGuardianOut, status_code=201)
def link_student_guardian(
    student_id: uuid.UUID, payload: StudentGuardianLink, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("students.edit"))
) -> StudentGuardian:
    return link_guardian(db, tenant_id=user.tenant_id, student_id=student_id, **payload.model_dump())


@router.get("/students/{student_id}/enrolments", response_model=list[StudentEnrolmentOut])
def list_student_enrolments(
    student_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("students.view"))
) -> list[StudentEnrolment]:
    return db.execute(select(StudentEnrolment).where(StudentEnrolment.student_id == student_id).order_by(StudentEnrolment.enrolment_date.desc())).scalars().all()


@router.post("/students/{student_id}/enrolments", response_model=StudentEnrolmentOut, status_code=201)
def create_student_enrolment(
    student_id: uuid.UUID, payload: StudentEnrolmentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("students.edit"))
) -> StudentEnrolment:
    return enrol_student(db, tenant_id=user.tenant_id, student_id=student_id, **payload.model_dump())
