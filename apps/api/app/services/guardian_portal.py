"""ADR-032: Guardian (Parent) Portal. Every function here takes a
`guardian` (from deps.get_portal_guardian) and scopes to exactly the
students that guardian is actually linked to via StudentGuardian --
ownership is re-checked on every lookup by student_id, not assumed
from the id alone, the same discipline services/portal.py's own
module docstring establishes for the customer portal (ADR-009): RLS
only enforces tenant isolation, never per-guardian isolation within a
tenant.

Every read here calls straight into the same service functions the
staff-facing UI already uses (get_student_attendance_history,
get_student_homework, get_student_fee_summary, get_report_card,
get_section_timetable) -- a guardian's view is the same real data
staff sees, filtered to their own children, not a parallel read path.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Guardian, SchoolClass, Section, Student, StudentGuardian
from app.models.examinations import Examination
from app.models.user import Role, User, UserRole
from app.security import hash_password
from app.services.education import get_current_enrolment
from app.services.examinations import get_report_card
from app.services.fees import get_student_fee_summary
from app.services.homework import get_student_homework
from app.services.student_attendance import get_student_attendance_history
from app.services.timetable import get_section_timetable
from app.services.transport import get_student_transport
from app.services.library import get_student_library_history
from app.services.hostel import get_student_hostel
from app.models.timetable import Subject, TimetableSlot

# ------------------------------------------------------------- Provisioning


def create_guardian_portal_login(
    db: Session, *, tenant_id: uuid.UUID, guardian: Guardian, email: str, password: str, full_name: str,
) -> User:
    """Staff-side action (StudentDetailPage's "Grant portal access"),
    modeled directly on services/portal.py's create_portal_login. The
    "guardian" role carries no RBAC permissions -- guardian-portal
    endpoints scope on User.guardian_id via deps.get_portal_guardian,
    not on permission checks.
    """
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "A user with this email already exists.", status_code=409)

    role = db.execute(select(Role).where(Role.tenant_id == tenant_id, Role.name == "guardian")).scalar_one_or_none()
    if role is None:
        role = Role(tenant_id=tenant_id, name="guardian", is_system=True)
        db.add(role)
        db.flush()

    user = User(
        tenant_id=tenant_id, email=email, hashed_password=hash_password(password), full_name=full_name,
        guardian_id=guardian.id,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(tenant_id=tenant_id, user_id=user.id, role_id=role.id, branch_id=None))
    # Guardian.user_id's own docstring: "link it when self-service
    # actually activates" -- this is that moment. Real bug fix (ADR-044
    # Student 360): this was never set before, so every guardian read
    # as "portal inactive" even with a real, working login, since
    # nothing ever populated the back-reference the field exists for.
    guardian.user_id = user.id
    db.flush()
    return user


# ------------------------------------------------------------------- Reads


def _owned_student(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> Student:
    link = db.execute(
        select(StudentGuardian).where(
            StudentGuardian.tenant_id == tenant_id, StudentGuardian.guardian_id == guardian_id, StudentGuardian.student_id == student_id
        )
    ).scalar_one_or_none()
    if link is None:
        raise AppError(ErrorCode.NOT_FOUND, "Student not found.", status_code=404)
    student = db.get(Student, student_id)
    if student is None:
        raise AppError(ErrorCode.NOT_FOUND, "Student not found.", status_code=404)
    return student


def list_own_children(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID) -> list[dict]:
    links = db.execute(
        select(StudentGuardian, Student)
        .join(Student, Student.id == StudentGuardian.student_id)
        .where(StudentGuardian.tenant_id == tenant_id, StudentGuardian.guardian_id == guardian_id)
        .order_by(Student.first_name)
    ).all()

    results = []
    for link, student in links:
        enrolment = get_current_enrolment(db, tenant_id=tenant_id, student_id=student.id)
        school_class = db.get(SchoolClass, enrolment.school_class_id) if enrolment else None
        section = db.get(Section, enrolment.section_id) if enrolment and enrolment.section_id else None
        results.append({
            "student_id": student.id, "first_name": student.first_name, "last_name": student.last_name,
            "admission_number": student.admission_number, "relationship_type": link.relationship_type,
            "school_class_id": enrolment.school_class_id if enrolment else None,
            "school_class_name": school_class.name if school_class else None,
            "section_id": enrolment.section_id if enrolment else None,
            "section_name": section.name if section else None,
        })
    return results


def get_child_attendance(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID):
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_attendance_history(db, tenant_id=tenant_id, student_id=student_id)


def get_child_homework(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID):
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_homework(db, tenant_id=tenant_id, student_id=student_id)


def get_child_homework_attachment(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID, homework_id: uuid.UUID):
    """Re-derives the roster the same way get_child_homework does --
    a guardian can only download an attachment for homework their own
    child was actually assigned, not any homework_id in the tenant."""
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    entries = get_student_homework(db, tenant_id=tenant_id, student_id=student_id)
    if not any(e["homework"]["id"] == homework_id for e in entries):
        raise AppError(ErrorCode.NOT_FOUND, "Homework not found for this child.", status_code=404)
    from app.models.homework import Homework
    homework = db.get(Homework, homework_id)
    if homework is None or homework.attachment_path is None:
        raise AppError(ErrorCode.NOT_FOUND, "No attachment for this homework.", status_code=404)
    return homework


def get_child_fees(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID):
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_fee_summary(db, tenant_id=tenant_id, student_id=student_id)


def get_child_timetable(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    enrolment = get_current_enrolment(db, tenant_id=tenant_id, student_id=student_id)
    if enrolment is None or enrolment.section_id is None:
        return []

    entries = get_section_timetable(db, tenant_id=tenant_id, section_id=enrolment.section_id)
    slots = {s.id: s for s in db.execute(select(TimetableSlot).where(TimetableSlot.tenant_id == tenant_id)).scalars()}
    subjects = {s.id: s for s in db.execute(select(Subject).where(Subject.tenant_id == tenant_id)).scalars()}

    return [
        {
            "day_of_week": entry.day_of_week, "slot_name": slots[entry.slot_id].name,
            "start_time": slots[entry.slot_id].start_time.isoformat(), "end_time": slots[entry.slot_id].end_time.isoformat(),
            "subject_name": subjects[entry.subject_id].name, "room": entry.room,
        }
        for entry in entries
    ]


def list_child_examinations(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> list[Examination]:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    enrolment = get_current_enrolment(db, tenant_id=tenant_id, student_id=student_id)
    if enrolment is None:
        return []
    return db.execute(
        select(Examination).where(Examination.tenant_id == tenant_id, Examination.academic_year_id == enrolment.academic_year_id).order_by(Examination.start_date.desc())
    ).scalars().all()


def get_child_report_card(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID, examination_id: uuid.UUID) -> dict:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_report_card(db, tenant_id=tenant_id, examination_id=examination_id, student_id=student_id)


def get_child_transport(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> dict | None:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_transport(db, tenant_id=tenant_id, student_id=student_id)


def get_child_library(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_library_history(db, tenant_id=tenant_id, student_id=student_id)


def get_child_hostel(db: Session, *, tenant_id: uuid.UUID, guardian_id: uuid.UUID, student_id: uuid.UUID) -> dict | None:
    _owned_student(db, tenant_id=tenant_id, guardian_id=guardian_id, student_id=student_id)
    return get_student_hostel(db, tenant_id=tenant_id, student_id=student_id)
