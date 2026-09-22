"""Analytics & Reporting (Phase 7, spec sec26). Every number here is
computed on read, straight off the real tables every other module in
this vertical already writes -- no new tables, no cached/precomputed
rollups to drift out of sync, and no fabricated metric: a metric that
has no honest real denominator (e.g. "transport utilization %" --
Vehicle.capacity_kg is a freight-unit field from the reused core fleet
model, not a passenger seat count) is reported as a real count
instead of a percentage that would imply data this app doesn't have.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.education import AcademicYear, SchoolClass, Section, Student, StudentEnrolment
from app.models.examinations import ExamMark, ExamSubjectSchedule
from app.models.fees import FeeInvoice
from app.models.hostel import HostelRoom, StudentHostelAllocation
from app.models.homework import Homework, HomeworkSubmission
from app.models.library import BookIssue
from app.models.sales import Invoice, PaymentAllocation
from app.models.student_attendance import StudentAttendanceRecord
from app.models.transport import StudentTransportAssignment, TransportRoute


def _current_academic_year(db: Session, tenant_id: uuid.UUID) -> AcademicYear | None:
    return db.execute(select(AcademicYear).where(AcademicYear.tenant_id == tenant_id, AcademicYear.is_current.is_(True))).scalar_one_or_none()


def get_overview(db: Session, *, tenant_id: uuid.UUID) -> dict:
    year = _current_academic_year(db, tenant_id)
    since = date.today() - timedelta(days=30)

    total_students = db.execute(
        select(func.count()).select_from(Student).where(Student.tenant_id == tenant_id, Student.status == "active")
    ).scalar_one()

    att_present, att_total = db.execute(
        select(
            func.count().filter(StudentAttendanceRecord.status == "present"),
            func.count(),
        )
        .select_from(StudentAttendanceRecord)
        .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.attendance_date >= since)
    ).one()
    attendance_pct = round(att_present / att_total * 100, 1) if att_total else None

    invoiced_total = Decimal(0)
    collected_total = Decimal(0)
    if year:
        invoice_ids = [
            row[0] for row in db.execute(
                select(FeeInvoice.invoice_id).where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.academic_year_id == year.id)
            ).all()
        ]
        if invoice_ids:
            invoiced_total = db.execute(select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.id.in_(invoice_ids))).scalar_one()
            collected_total = db.execute(
                select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(PaymentAllocation.invoice_id.in_(invoice_ids))
            ).scalar_one()
    fee_collection_pct = round(float(collected_total) / float(invoiced_total) * 100, 1) if invoiced_total else None

    library_issued = db.execute(
        select(func.count()).select_from(BookIssue).where(BookIssue.tenant_id == tenant_id, BookIssue.status == "issued")
    ).scalar_one()

    transport_students = 0
    transport_routes = 0
    hostel_occupied_beds = 0
    hostel_total_beds = 0
    if year:
        transport_students = db.execute(
            select(func.count()).select_from(StudentTransportAssignment).where(StudentTransportAssignment.tenant_id == tenant_id, StudentTransportAssignment.academic_year_id == year.id)
        ).scalar_one()
        transport_routes = db.execute(select(func.count()).select_from(TransportRoute).where(TransportRoute.tenant_id == tenant_id, TransportRoute.is_active.is_(True))).scalar_one()
        hostel_occupied_beds = db.execute(
            select(func.count()).select_from(StudentHostelAllocation).where(StudentHostelAllocation.tenant_id == tenant_id, StudentHostelAllocation.academic_year_id == year.id)
        ).scalar_one()
        hostel_total_beds = db.execute(select(func.coalesce(func.sum(HostelRoom.capacity), 0)).where(HostelRoom.tenant_id == tenant_id)).scalar_one()
    hostel_occupancy_pct = round(hostel_occupied_beds / hostel_total_beds * 100, 1) if hostel_total_beds else None

    return {
        "total_active_students": total_students,
        "attendance_pct_last_30_days": attendance_pct,
        "fee_collection_pct": fee_collection_pct,
        "fee_invoiced_total": invoiced_total, "fee_collected_total": collected_total,
        "library_books_issued": library_issued,
        "transport_students_assigned": transport_students, "transport_routes": transport_routes,
        "hostel_occupancy_pct": hostel_occupancy_pct, "hostel_occupied_beds": hostel_occupied_beds, "hostel_total_beds": hostel_total_beds,
    }


def get_attendance_trend(db: Session, *, tenant_id: uuid.UUID, days: int) -> list[dict]:
    since = date.today() - timedelta(days=days)
    rows = db.execute(
        select(
            StudentAttendanceRecord.attendance_date,
            func.count().filter(StudentAttendanceRecord.status == "present"),
            func.count(),
        )
        .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.attendance_date >= since)
        .group_by(StudentAttendanceRecord.attendance_date)
        .order_by(StudentAttendanceRecord.attendance_date)
    ).all()
    return [{"date": str(d), "attendance_pct": round(present / total * 100, 1) if total else 0} for d, present, total in rows]


def get_attendance_by_class(db: Session, *, tenant_id: uuid.UUID, days: int) -> list[dict]:
    since = date.today() - timedelta(days=days)
    rows = db.execute(
        select(
            SchoolClass.id, SchoolClass.name,
            func.count().filter(StudentAttendanceRecord.status == "present"),
            func.count(StudentAttendanceRecord.id),
        )
        .join(SchoolClass, SchoolClass.id == StudentAttendanceRecord.school_class_id)
        .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.attendance_date >= since)
        .group_by(SchoolClass.id, SchoolClass.name)
        .order_by(SchoolClass.sequence)
    ).all()
    return [{"school_class_id": cid, "school_class_name": name, "attendance_pct": round(present / total * 100, 1) if total else 0} for cid, name, present, total in rows]


def get_fee_collection_by_class(db: Session, *, tenant_id: uuid.UUID) -> list[dict]:
    year = _current_academic_year(db, tenant_id)
    if year is None:
        return []

    rows = db.execute(
        select(SchoolClass.id, SchoolClass.name, func.coalesce(func.sum(Invoice.total), 0))
        .select_from(FeeInvoice)
        .join(Invoice, Invoice.id == FeeInvoice.invoice_id)
        .join(StudentEnrolment, (StudentEnrolment.student_id == FeeInvoice.student_id) & (StudentEnrolment.academic_year_id == FeeInvoice.academic_year_id))
        .join(SchoolClass, SchoolClass.id == StudentEnrolment.school_class_id)
        .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.academic_year_id == year.id)
        .group_by(SchoolClass.id, SchoolClass.name, SchoolClass.sequence)
        .order_by(SchoolClass.sequence)
    ).all()

    result = []
    for class_id, class_name, invoiced in rows:
        invoice_ids = [
            r[0] for r in db.execute(
                select(FeeInvoice.invoice_id)
                .join(StudentEnrolment, (StudentEnrolment.student_id == FeeInvoice.student_id) & (StudentEnrolment.academic_year_id == FeeInvoice.academic_year_id))
                .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.academic_year_id == year.id, StudentEnrolment.school_class_id == class_id)
            ).all()
        ]
        collected = db.execute(select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(PaymentAllocation.invoice_id.in_(invoice_ids))).scalar_one() if invoice_ids else Decimal(0)
        result.append({"school_class_id": class_id, "school_class_name": class_name, "invoiced": invoiced, "collected": collected})
    return result


def get_exam_performance(db: Session, *, tenant_id: uuid.UUID, examination_id: uuid.UUID) -> list[dict]:
    rows = db.execute(
        select(
            ExamSubjectSchedule.subject_id,
            func.avg(case((ExamMark.is_absent.is_(False), ExamMark.marks_obtained / ExamSubjectSchedule.max_marks * 100), else_=None)),
            func.count().filter(ExamMark.is_absent.is_(False)),
        )
        .select_from(ExamSubjectSchedule)
        .join(ExamMark, ExamMark.exam_subject_schedule_id == ExamSubjectSchedule.id)
        .where(ExamSubjectSchedule.tenant_id == tenant_id, ExamSubjectSchedule.examination_id == examination_id)
        .group_by(ExamSubjectSchedule.subject_id)
    ).all()

    from app.models.timetable import Subject
    subject_names = {s.id: s.name for s in db.execute(select(Subject).where(Subject.tenant_id == tenant_id)).scalars()}

    return [
        {"subject_id": subject_id, "subject_name": subject_names.get(subject_id, "-"), "average_pct": round(float(avg_pct), 1) if avg_pct is not None else None, "students_marked": count}
        for subject_id, avg_pct, count in rows
    ]


def get_homework_completion_by_section(db: Session, *, tenant_id: uuid.UUID) -> list[dict]:
    year = _current_academic_year(db, tenant_id)
    if year is None:
        return []

    rows = db.execute(
        select(
            Section.id, Section.name, SchoolClass.name,
            func.count().filter(HomeworkSubmission.status.in_(["submitted", "late"])),
            func.count(HomeworkSubmission.id),
        )
        .select_from(Homework)
        .join(Section, Section.id == Homework.section_id)
        .join(SchoolClass, SchoolClass.id == Section.school_class_id)
        .join(HomeworkSubmission, HomeworkSubmission.homework_id == Homework.id)
        .where(Homework.tenant_id == tenant_id, SchoolClass.academic_year_id == year.id)
        .group_by(Section.id, Section.name, SchoolClass.name)
    ).all()

    return [
        {"section_id": sid, "section_label": f"{cname} - {sname}", "completion_pct": round(done / total * 100, 1) if total else 0, "tracked_submissions": total}
        for sid, sname, cname, done, total in rows
    ]
