import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Section, Student, StudentEnrolment
from app.models.homework import Homework, HomeworkSubmission


def _section(db: Session, tenant_id: uuid.UUID, section_id: uuid.UUID) -> Section:
    section = db.get(Section, section_id)
    if section is None or section.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Section not found.")
    return section


def create_homework(
    db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID, subject_id: uuid.UUID, title: str,
    description: str | None, assigned_date: date, due_date: date, created_by_user_id: uuid.UUID | None,
) -> Homework:
    _section(db, tenant_id, section_id)
    if due_date < assigned_date:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Due date cannot be before the assigned date.")
    homework = Homework(
        tenant_id=tenant_id, section_id=section_id, subject_id=subject_id, title=title, description=description,
        assigned_date=assigned_date, due_date=due_date, created_by_user_id=created_by_user_id,
    )
    db.add(homework)
    db.flush()
    return homework


def _homework(db: Session, tenant_id: uuid.UUID, homework_id: uuid.UUID) -> Homework:
    homework = db.get(Homework, homework_id)
    if homework is None or homework.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Homework not found.", status_code=404)
    return homework


def update_homework(db: Session, *, tenant_id: uuid.UUID, homework_id: uuid.UUID, **fields) -> Homework:
    homework = _homework(db, tenant_id, homework_id)
    for key, value in fields.items():
        if value is not None:
            setattr(homework, key, value)
    db.flush()
    return homework


def list_homework(db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID | None = None) -> list[Homework]:
    stmt = select(Homework).where(Homework.tenant_id == tenant_id).order_by(Homework.due_date.desc())
    if section_id:
        stmt = stmt.where(Homework.section_id == section_id)
    return db.execute(stmt).scalars().all()


def get_homework_roster(db: Session, *, tenant_id: uuid.UUID, homework_id: uuid.UUID) -> list[dict]:
    homework = _homework(db, tenant_id, homework_id)

    enrolments = db.execute(
        select(StudentEnrolment, Student)
        .join(Student, Student.id == StudentEnrolment.student_id)
        .where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.section_id == homework.section_id)
        .order_by(StudentEnrolment.roll_number)
    ).all()

    existing = {
        s.student_id: s
        for s in db.execute(
            select(HomeworkSubmission).where(HomeworkSubmission.tenant_id == tenant_id, HomeworkSubmission.homework_id == homework_id)
        ).scalars()
    }

    return [
        {
            "student_id": student.id, "first_name": student.first_name, "last_name": student.last_name,
            "roll_number": enrolment.roll_number,
            "status": existing[student.id].status if student.id in existing else "pending",
            "submitted_date": existing[student.id].submitted_date if student.id in existing else None,
            "remarks": existing[student.id].remarks if student.id in existing else None,
        }
        for enrolment, student in enrolments
    ]


def bulk_upsert_submissions(db: Session, *, tenant_id: uuid.UUID, homework_id: uuid.UUID, records: list[dict]) -> list[HomeworkSubmission]:
    _homework(db, tenant_id, homework_id)

    saved: list[HomeworkSubmission] = []
    for row in records:
        student = db.get(Student, row["student_id"])
        if student is None or student.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Student {row['student_id']} not found.")

        existing = db.execute(
            select(HomeworkSubmission).where(
                HomeworkSubmission.tenant_id == tenant_id, HomeworkSubmission.homework_id == homework_id, HomeworkSubmission.student_id == student.id
            )
        ).scalar_one_or_none()

        submitted_date = date.today() if row["status"] in ("submitted", "late") else None

        if existing is not None:
            existing.status = row["status"]
            existing.remarks = row.get("remarks")
            existing.submitted_date = submitted_date
            saved.append(existing)
        else:
            submission = HomeworkSubmission(
                tenant_id=tenant_id, homework_id=homework_id, student_id=student.id,
                status=row["status"], remarks=row.get("remarks"), submitted_date=submitted_date,
            )
            db.add(submission)
            saved.append(submission)

    db.flush()
    return saved


def get_student_homework(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    """Every homework assigned to any section this student has ever
    been enrolled in, with their own submission status (or "pending"
    if a teacher hasn't marked it yet) -- resolved from the student's
    real enrolment history, not a cached "current section" pointer."""
    section_ids = [
        row[0] for row in db.execute(
            select(StudentEnrolment.section_id).where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.student_id == student_id)
        ).all()
        if row[0] is not None
    ]
    if not section_ids:
        return []

    rows = db.execute(
        select(Homework).where(Homework.tenant_id == tenant_id, Homework.section_id.in_(section_ids)).order_by(Homework.due_date.desc())
    ).scalars().all()

    submissions = {
        s.homework_id: s
        for s in db.execute(
            select(HomeworkSubmission).where(HomeworkSubmission.tenant_id == tenant_id, HomeworkSubmission.student_id == student_id)
        ).scalars()
    }

    return [
        {
            "homework": hw,
            "status": submissions[hw.id].status if hw.id in submissions else "pending",
        }
        for hw in rows
    ]
