import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Section, Student, StudentEnrolment
from app.models.student_attendance import StudentAttendanceRecord


def get_roster(db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID, attendance_date: date) -> list[dict]:
    """Every student currently enrolled in this section (via their real
    StudentEnrolment row, not a cached roster list), each carrying
    whatever attendance status is already recorded for the date, or
    null if not yet marked."""
    section = db.get(Section, section_id)
    if section is None or section.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Section not found.")

    enrolments = db.execute(
        select(StudentEnrolment, Student)
        .join(Student, Student.id == StudentEnrolment.student_id)
        .where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.section_id == section_id)
        .order_by(StudentEnrolment.roll_number)
    ).all()

    existing = {
        r.student_id: r.status
        for r in db.execute(
            select(StudentAttendanceRecord).where(
                StudentAttendanceRecord.tenant_id == tenant_id,
                StudentAttendanceRecord.section_id == section_id,
                StudentAttendanceRecord.attendance_date == attendance_date,
            )
        ).scalars()
    }

    return [
        {
            "student_id": student.id, "first_name": student.first_name, "last_name": student.last_name,
            "roll_number": enrolment.roll_number, "status": existing.get(student.id),
        }
        for enrolment, student in enrolments
    ]


def mark_bulk_attendance(
    db: Session, *, tenant_id: uuid.UUID, section_id: uuid.UUID, attendance_date: date, marked_by_user_id: uuid.UUID, records: list[dict]
) -> list[StudentAttendanceRecord]:
    section = db.get(Section, section_id)
    if section is None or section.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Section not found.")

    saved: list[StudentAttendanceRecord] = []
    for row in records:
        student = db.get(Student, row["student_id"])
        if student is None or student.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Student {row['student_id']} not found.")

        existing = db.execute(
            select(StudentAttendanceRecord).where(
                StudentAttendanceRecord.tenant_id == tenant_id,
                StudentAttendanceRecord.student_id == student.id,
                StudentAttendanceRecord.attendance_date == attendance_date,
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.status = row["status"]
            existing.remarks = row.get("remarks")
            existing.marked_by_user_id = marked_by_user_id
            existing.section_id = section_id
            existing.school_class_id = section.school_class_id
            saved.append(existing)
        else:
            record = StudentAttendanceRecord(
                tenant_id=tenant_id, student_id=student.id, school_class_id=section.school_class_id, section_id=section_id,
                attendance_date=attendance_date, status=row["status"], remarks=row.get("remarks"), marked_by_user_id=marked_by_user_id,
            )
            db.add(record)
            saved.append(record)

    db.flush()
    return saved


def get_student_attendance_history(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[StudentAttendanceRecord]:
    return db.execute(
        select(StudentAttendanceRecord)
        .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.student_id == student_id)
        .order_by(StudentAttendanceRecord.attendance_date.desc())
    ).scalars().all()
