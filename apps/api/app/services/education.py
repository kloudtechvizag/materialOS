import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import (
    AcademicYear,
    Guardian,
    SchoolClass,
    Section,
    Student,
    StudentEnrolment,
    StudentGuardian,
)


def _next_admission_number(db: Session, tenant_id: uuid.UUID) -> str:
    count = db.execute(select(func.count()).select_from(Student).where(Student.tenant_id == tenant_id)).scalar_one()
    return f"STU-{count + 1:04d}"


def create_academic_year(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, name: str, start_date: date, end_date: date, is_current: bool
) -> AcademicYear:
    if is_current:
        # Exactly one current year per company -- flip every other year
        # for this company off in the same transaction (see model
        # docstring: no DB constraint enforces this yet).
        for existing in db.execute(
            select(AcademicYear).where(AcademicYear.tenant_id == tenant_id, AcademicYear.company_id == company_id, AcademicYear.is_current.is_(True))
        ).scalars():
            existing.is_current = False

    year = AcademicYear(tenant_id=tenant_id, company_id=company_id, name=name, start_date=start_date, end_date=end_date, is_current=is_current)
    db.add(year)
    db.flush()
    return year


def create_school_class(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, academic_year_id: uuid.UUID, name: str, sequence: int) -> SchoolClass:
    year = db.get(AcademicYear, academic_year_id)
    if year is None or year.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Academic year not found.")

    school_class = SchoolClass(tenant_id=tenant_id, company_id=company_id, academic_year_id=academic_year_id, name=name, sequence=sequence)
    db.add(school_class)
    db.flush()
    return school_class


def create_section(
    db: Session, *, tenant_id: uuid.UUID, school_class_id: uuid.UUID, name: str, capacity: int | None, class_teacher_id: uuid.UUID | None
) -> Section:
    school_class = db.get(SchoolClass, school_class_id)
    if school_class is None or school_class.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Class not found.")

    section = Section(tenant_id=tenant_id, school_class_id=school_class_id, name=name, capacity=capacity, class_teacher_id=class_teacher_id)
    db.add(section)
    db.flush()
    return section


def create_guardian(db: Session, *, tenant_id: uuid.UUID, **fields) -> Guardian:
    guardian = Guardian(tenant_id=tenant_id, **fields)
    db.add(guardian)
    db.flush()
    return guardian


def link_guardian(
    db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID, guardian_id: uuid.UUID, relationship_type: str, is_primary_contact: bool
) -> StudentGuardian:
    student = db.get(Student, student_id)
    if student is None or student.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Student not found.", status_code=404)
    guardian = db.get(Guardian, guardian_id)
    if guardian is None or guardian.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Guardian not found.")

    existing = db.execute(
        select(StudentGuardian).where(StudentGuardian.tenant_id == tenant_id, StudentGuardian.student_id == student_id, StudentGuardian.guardian_id == guardian_id)
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "This guardian is already linked to this student.", status_code=409)

    link = StudentGuardian(tenant_id=tenant_id, student_id=student_id, guardian_id=guardian_id, relationship_type=relationship_type, is_primary_contact=is_primary_contact)
    db.add(link)
    db.flush()
    return link


def enrol_student(
    db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID, academic_year_id: uuid.UUID, school_class_id: uuid.UUID,
    section_id: uuid.UUID | None, roll_number: str | None, enrolment_date: date | None,
) -> StudentEnrolment:
    year = db.get(AcademicYear, academic_year_id)
    if year is None or year.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Academic year not found.")
    school_class = db.get(SchoolClass, school_class_id)
    if school_class is None or school_class.tenant_id != tenant_id or school_class.academic_year_id != academic_year_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Class does not belong to this academic year.")
    if section_id is not None:
        section = db.get(Section, section_id)
        if section is None or section.tenant_id != tenant_id or section.school_class_id != school_class_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Section does not belong to this class.")

    existing = db.execute(
        select(StudentEnrolment).where(
            StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.student_id == student_id, StudentEnrolment.academic_year_id == academic_year_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "This student already has an enrolment for this academic year.", status_code=409)

    enrolment = StudentEnrolment(
        tenant_id=tenant_id, student_id=student_id, academic_year_id=academic_year_id, school_class_id=school_class_id,
        section_id=section_id, roll_number=roll_number, enrolment_date=enrolment_date or date.today(),
    )
    db.add(enrolment)
    db.flush()
    return enrolment


def create_student(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, **fields) -> Student:
    academic_year_id = fields.pop("academic_year_id", None)
    school_class_id = fields.pop("school_class_id", None)
    section_id = fields.pop("section_id", None)
    roll_number = fields.pop("roll_number", None)

    student = Student(
        tenant_id=tenant_id, company_id=company_id,
        admission_number=fields.pop("admission_number", None) or _next_admission_number(db, tenant_id),
        **fields,
    )
    db.add(student)
    db.flush()

    if academic_year_id and school_class_id:
        enrol_student(
            db, tenant_id=tenant_id, student_id=student.id, academic_year_id=academic_year_id,
            school_class_id=school_class_id, section_id=section_id, roll_number=roll_number, enrolment_date=student.admission_date,
        )

    return student


def get_current_enrolment(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentEnrolment | None:
    """The student's enrolment for whichever AcademicYear is currently
    flagged is_current -- resolved live, never cached on Student itself
    (see models/education.py's own docstring on why)."""
    return db.execute(
        select(StudentEnrolment)
        .join(AcademicYear, AcademicYear.id == StudentEnrolment.academic_year_id)
        .where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.student_id == student_id, AcademicYear.is_current.is_(True))
    ).scalar_one_or_none()
