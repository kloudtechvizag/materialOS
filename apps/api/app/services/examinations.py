import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Section, Student, StudentEnrolment
from app.models.examinations import ExamMark, ExamSubjectSchedule, Examination
from app.models.timetable import Subject

# Percentage grade bands -- a real, working default, not per-school
# configurable in this pass (named in ADR-029's "Deliberately not
# built"). Applied identically at the subject level and the overall
# report-card level.
GRADE_BANDS = [(90, "A+"), (75, "A"), (60, "B"), (40, "C"), (0, "D")]


def _grade_for_percentage(percentage: Decimal) -> str:
    for threshold, grade in GRADE_BANDS:
        if percentage >= threshold:
            return grade
    return "D"


TWO_PLACES = Decimal("0.01")


def _percentage(obtained: Decimal, max_marks: Decimal) -> Decimal:
    """Decimal division of an exact zero carries the divisor's exponent
    (e.g. Decimal(0) / Decimal('100.00') -> Decimal('0E+2')), which
    renders as "0E+2" over the wire instead of "0.00" -- quantize
    explicitly rather than trusting Decimal's default exponent."""
    if not max_marks:
        return Decimal(0)
    return (obtained / max_marks * 100).quantize(TWO_PLACES)


def create_examination(db: Session, *, tenant_id: uuid.UUID, academic_year_id: uuid.UUID, name: str, start_date, end_date) -> Examination:
    if end_date < start_date:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Examination end date must be on or after its start date.")
    exam = Examination(tenant_id=tenant_id, academic_year_id=academic_year_id, name=name, start_date=start_date, end_date=end_date)
    db.add(exam)
    db.flush()
    return exam


def update_examination(db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID, **fields) -> Examination:
    exam = _examination(db, tenant_id, examination_id)
    for key, value in fields.items():
        if value is not None:
            setattr(exam, key, value)
    db.flush()
    return exam


def set_examination_lock(db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID, is_locked: bool) -> Examination:
    exam = _examination(db, tenant_id, examination_id)
    exam.is_locked = is_locked
    db.flush()
    return exam


def _examination(db: Session, tenant_id: uuid.UUID, examination_id: uuid.UUID) -> Examination:
    exam = db.get(Examination, examination_id)
    if exam is None or exam.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Examination not found.", status_code=404)
    return exam


def create_exam_subject_schedule(
    db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID, school_class_id: uuid.UUID, subject_id: uuid.UUID,
    exam_date, max_marks: Decimal, pass_marks: Decimal,
) -> ExamSubjectSchedule:
    _examination(db, tenant_id, examination_id)
    if pass_marks > max_marks:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Pass marks cannot exceed max marks.")
    schedule = ExamSubjectSchedule(
        tenant_id=tenant_id, examination_id=examination_id, school_class_id=school_class_id, subject_id=subject_id,
        exam_date=exam_date, max_marks=max_marks, pass_marks=pass_marks,
    )
    db.add(schedule)
    db.flush()
    return schedule


def list_exam_subject_schedules(db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID) -> list[ExamSubjectSchedule]:
    _examination(db, tenant_id, examination_id)
    return db.execute(
        select(ExamSubjectSchedule).where(ExamSubjectSchedule.tenant_id == tenant_id, ExamSubjectSchedule.examination_id == examination_id)
    ).scalars().all()


def _schedule(db: Session, tenant_id: uuid.UUID, schedule_id: uuid.UUID) -> ExamSubjectSchedule:
    schedule = db.get(ExamSubjectSchedule, schedule_id)
    if schedule is None or schedule.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Exam subject schedule not found.", status_code=404)
    return schedule


def get_exam_roster(db: Session, *, tenant_id: uuid.UUID, schedule_id: uuid.UUID, section_id: uuid.UUID) -> list[dict]:
    schedule = _schedule(db, tenant_id, schedule_id)
    section = db.get(Section, section_id)
    if section is None or section.tenant_id != tenant_id or section.school_class_id != schedule.school_class_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Section does not belong to this exam's class.")

    enrolments = db.execute(
        select(StudentEnrolment, Student)
        .join(Student, Student.id == StudentEnrolment.student_id)
        .where(StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.section_id == section_id)
        .order_by(StudentEnrolment.roll_number)
    ).all()

    existing = {
        m.student_id: m
        for m in db.execute(
            select(ExamMark).where(ExamMark.tenant_id == tenant_id, ExamMark.exam_subject_schedule_id == schedule_id)
        ).scalars()
    }

    return [
        {
            "student_id": student.id, "first_name": student.first_name, "last_name": student.last_name,
            "roll_number": enrolment.roll_number,
            "marks_obtained": existing[student.id].marks_obtained if student.id in existing else None,
            "is_absent": existing[student.id].is_absent if student.id in existing else False,
            "remarks": existing[student.id].remarks if student.id in existing else None,
        }
        for enrolment, student in enrolments
    ]


def bulk_upsert_marks(db: Session, *, tenant_id: uuid.UUID, schedule_id: uuid.UUID, records: list[dict]) -> list[ExamMark]:
    schedule = _schedule(db, tenant_id, schedule_id)
    exam = _examination(db, tenant_id, schedule.examination_id)
    if exam.is_locked:
        raise AppError(ErrorCode.PERIOD_LOCKED, f"Examination '{exam.name}' is locked; unlock it before editing marks.", status_code=409)

    saved: list[ExamMark] = []
    for row in records:
        marks_obtained = row.get("marks_obtained")
        is_absent = row.get("is_absent", False)
        if not is_absent and marks_obtained is not None and marks_obtained > schedule.max_marks:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Marks obtained cannot exceed the max marks ({schedule.max_marks}).")

        student = db.get(Student, row["student_id"])
        if student is None or student.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Student {row['student_id']} not found.")

        existing = db.execute(
            select(ExamMark).where(
                ExamMark.tenant_id == tenant_id, ExamMark.exam_subject_schedule_id == schedule_id, ExamMark.student_id == student.id
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.marks_obtained = None if is_absent else marks_obtained
            existing.is_absent = is_absent
            existing.remarks = row.get("remarks")
            saved.append(existing)
        else:
            mark = ExamMark(
                tenant_id=tenant_id, exam_subject_schedule_id=schedule_id, student_id=student.id,
                marks_obtained=None if is_absent else marks_obtained, is_absent=is_absent, remarks=row.get("remarks"),
            )
            db.add(mark)
            saved.append(mark)

    db.flush()
    return saved


def get_report_card(db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID, student_id: uuid.UUID) -> dict:
    exam = _examination(db, tenant_id, examination_id)

    enrolment = db.execute(
        select(StudentEnrolment).where(
            StudentEnrolment.tenant_id == tenant_id, StudentEnrolment.student_id == student_id, StudentEnrolment.academic_year_id == exam.academic_year_id
        )
    ).scalar_one_or_none()
    if enrolment is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Student is not enrolled for this examination's academic year.")

    schedules = db.execute(
        select(ExamSubjectSchedule, Subject)
        .join(Subject, Subject.id == ExamSubjectSchedule.subject_id)
        .where(ExamSubjectSchedule.tenant_id == tenant_id, ExamSubjectSchedule.examination_id == examination_id, ExamSubjectSchedule.school_class_id == enrolment.school_class_id)
    ).all()

    marks_by_schedule = {
        m.exam_subject_schedule_id: m
        for m in db.execute(
            select(ExamMark)
            .join(ExamSubjectSchedule, ExamSubjectSchedule.id == ExamMark.exam_subject_schedule_id)
            .where(ExamMark.tenant_id == tenant_id, ExamMark.student_id == student_id, ExamSubjectSchedule.examination_id == examination_id)
        ).scalars()
    }

    subjects_out = []
    total_obtained = Decimal(0)
    total_max = Decimal(0)
    any_unmarked = False
    any_fail = False

    for schedule, subject in schedules:
        mark = marks_by_schedule.get(schedule.id)
        if mark is None:
            any_unmarked = True
            subjects_out.append({
                "subject_id": subject.id, "subject_name": subject.name, "max_marks": schedule.max_marks, "pass_marks": schedule.pass_marks,
                "marks_obtained": None, "is_absent": False, "is_pass": None, "grade": None,
            })
            continue

        is_pass = (not mark.is_absent) and mark.marks_obtained is not None and mark.marks_obtained >= schedule.pass_marks
        if mark.is_absent or not is_pass:
            any_fail = True
        obtained = Decimal(0) if mark.is_absent else (mark.marks_obtained or Decimal(0))
        total_obtained += obtained
        total_max += schedule.max_marks
        subject_pct = _percentage(obtained, schedule.max_marks)

        subjects_out.append({
            "subject_id": subject.id, "subject_name": subject.name, "max_marks": schedule.max_marks, "pass_marks": schedule.pass_marks,
            "marks_obtained": None if mark.is_absent else mark.marks_obtained, "is_absent": mark.is_absent,
            "is_pass": is_pass, "grade": None if mark.is_absent else _grade_for_percentage(subject_pct),
        })

    percentage = _percentage(total_obtained, total_max) if total_max else None
    overall_result = "incomplete" if any_unmarked else ("fail" if any_fail else "pass")
    overall_grade = _grade_for_percentage(percentage) if (percentage is not None and not any_unmarked) else None

    return {
        "student_id": student_id, "examination_id": examination_id, "examination_name": exam.name, "subjects": subjects_out,
        "total_marks_obtained": total_obtained, "total_max_marks": total_max, "percentage": percentage,
        "overall_grade": overall_grade, "overall_result": overall_result,
    }
