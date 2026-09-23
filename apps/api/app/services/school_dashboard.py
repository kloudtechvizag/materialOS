"""School Dashboard (ADR-046) -- every number here is computed on read
off tables the vertical already writes, the same discipline
services/analytics.py (ADR-037) established: no cached rollup, no
fabricated metric.

Personalization is real, backend-enforced permission gating, not a
fake client-side role concept: no principal/teacher/counsellor/
transport-manager RBAC roles exist in this app today (only generic
trade roles plus the real, already-seeded per-resource permissions --
see services/permissions.py's RESOURCES catalog), so each section of
this summary is independently included only when the calling user
actually holds the real permission for that domain (deps.
user_permission_codes) -- a teacher without fees.view genuinely
receives `null` for every fee figure, not a UI-hidden number they
were still sent.

Deliberately NOT built this pass (named, not faked): AI-generated
insights (spec's own section 12 -- deferred, consistent with "skip AI
Copilot for now"), per-role dashboard *layouts* (this endpoint gates
data, the frontend still renders one layout for everyone who can see
it), drag-and-drop widget customization, fee concessions (not a
first-class concept anywhere in fees.py yet), timetable conflicts (the
real conflict check in services/timetable.py is preventive -- it
rejects at creation time, so there is no persisted "conflict" state to
surface), transport operational issues (no incident/issue model exists
on TransportRoute), and school events/meetings (no calendar/event
model exists -- "Today's Schedule" is built only from real exams and
real timetable periods, not a fabricated agenda).
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import user_permission_codes
from app.models.admissions import AdmissionApplication
from app.models.approvals import ApprovalRequest
from app.models.attendance import AttendanceRecord
from app.models.education import AcademicYear, SchoolClass, Section, Student
from app.models.examinations import Examination, ExamSubjectSchedule
from app.models.fees import FeeInvoice, FeeInvoiceLine, FeeStructureItem
from app.models.hr import Employee
from app.models.homework import Homework, HomeworkSubmission
from app.models.leave import LeaveRequest
from app.models.sales import Invoice, PaymentAllocation, Receipt
from app.models.student_attendance import StudentAttendanceRecord
from app.models.timetable import Subject, TimetableEntry, TimetableSlot
from app.services.admissions import TERMINAL_STATUSES, get_admissions_summary

ATTENDANCE_CONCERN_THRESHOLD_PCT = 75
UPCOMING_EXAM_WINDOW_DAYS = 30
TODAY_SCHEDULE_PERIOD_LIMIT = 12


def _current_academic_year(db: Session, tenant_id: uuid.UUID) -> AcademicYear | None:
    return db.execute(select(AcademicYear).where(AcademicYear.tenant_id == tenant_id, AcademicYear.is_current.is_(True))).scalar_one_or_none()


def get_school_dashboard_summary(db: Session, *, tenant_id: uuid.UUID, user_id: uuid.UUID, branch_id: uuid.UUID | None = None) -> dict:
    perms = user_permission_codes(db, user_id)
    today = date.today()
    year = _current_academic_year(db, tenant_id)

    kpis: dict = {
        "total_active_students": None, "new_enquiries_this_week": None, "pending_admissions": None,
        "students_absent_today": None, "fees_collected_this_month": None, "fees_outstanding_total": None,
        "overdue_fee_accounts": None, "staff_present_today": None,
    }
    needs_attention: list[dict] = []

    # ---------------------------------------------------------- Students
    if "students.view" in perms:
        students_stmt = select(func.count()).select_from(Student).where(Student.tenant_id == tenant_id, Student.status == "active")
        if branch_id:
            students_stmt = students_stmt.where(Student.branch_id == branch_id)
        kpis["total_active_students"] = db.execute(students_stmt).scalar_one()

    # ------------------------------------------------------- Admissions
    admissions_summary = None
    if "admissions.view" in perms:
        admissions_summary = get_admissions_summary(db, tenant_id=tenant_id, branch_id=branch_id)
        kpis["new_enquiries_this_week"] = admissions_summary["new_enquiries"]

        pending_stmt = select(func.count()).select_from(AdmissionApplication).where(
            AdmissionApplication.tenant_id == tenant_id, AdmissionApplication.status.notin_(TERMINAL_STATUSES)
        )
        if branch_id:
            pending_stmt = pending_stmt.where(AdmissionApplication.branch_id == branch_id)
        kpis["pending_admissions"] = db.execute(pending_stmt).scalar_one()

        if kpis["pending_admissions"]:
            needs_attention.append({
                "key": "admissions_pending_review", "label": "Admission applications awaiting review",
                "count": kpis["pending_admissions"], "href": "/admission-applications", "severity": "medium",
            })
        if admissions_summary["overdue_follow_ups"]:
            needs_attention.append({
                "key": "admissions_followups_overdue", "label": "Admission follow-ups overdue",
                "count": admissions_summary["overdue_follow_ups"], "href": "/admission-enquiries", "severity": "high",
            })

    # ------------------------------------------------ Student attendance
    if "student_attendance.view" in perms:
        absent_stmt = (
            select(func.count(func.distinct(StudentAttendanceRecord.student_id)))
            .select_from(StudentAttendanceRecord)
            .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.attendance_date == today, StudentAttendanceRecord.status == "absent")
        )
        if branch_id:
            absent_stmt = absent_stmt.join(SchoolClass, SchoolClass.id == StudentAttendanceRecord.school_class_id).where(SchoolClass.branch_id == branch_id)
        kpis["students_absent_today"] = db.execute(absent_stmt).scalar_one()

        since_30 = today - timedelta(days=30)
        concern_query = (
            select(
                StudentAttendanceRecord.student_id,
                func.count().filter(StudentAttendanceRecord.status == "present").label("present"),
                func.count().label("total"),
            )
            .where(StudentAttendanceRecord.tenant_id == tenant_id, StudentAttendanceRecord.attendance_date >= since_30)
        )
        if branch_id:
            concern_query = concern_query.join(SchoolClass, SchoolClass.id == StudentAttendanceRecord.school_class_id).where(SchoolClass.branch_id == branch_id)
        concern_sub = concern_query.group_by(StudentAttendanceRecord.student_id).subquery()
        attendance_concern_count = db.execute(
            select(func.count()).select_from(concern_sub)
            .where(concern_sub.c.total > 0, (concern_sub.c.present * 100.0 / concern_sub.c.total) < ATTENDANCE_CONCERN_THRESHOLD_PCT)
        ).scalar_one()
        if attendance_concern_count:
            needs_attention.append({
                "key": "attendance_concerns", "label": f"Students with attendance below {ATTENDANCE_CONCERN_THRESHOLD_PCT}% this month",
                "count": attendance_concern_count, "href": "/student-attendance", "severity": "high",
            })

    # ------------------------------------------------------------- Fees
    fee_snapshot = None
    if "fees.view" in perms and year is not None:
        invoice_rows_stmt = select(FeeInvoice.id, FeeInvoice.invoice_id).where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.academic_year_id == year.id)
        if branch_id:
            invoice_rows_stmt = invoice_rows_stmt.join(Student, Student.id == FeeInvoice.student_id).where(Student.branch_id == branch_id)
        fee_invoice_rows = db.execute(invoice_rows_stmt).all()
        fee_invoice_ids = [r[0] for r in fee_invoice_rows]
        invoice_ids = [r[1] for r in fee_invoice_rows]

        invoiced_total = Decimal(0)
        collected_total = Decimal(0)
        collected_this_month = Decimal(0)
        collected_today = Decimal(0)
        overdue_accounts = 0

        if invoice_ids:
            invoiced_total = db.execute(select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.id.in_(invoice_ids))).scalar_one()
            collected_total = db.execute(select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(PaymentAllocation.invoice_id.in_(invoice_ids))).scalar_one()

            month_start = today.replace(day=1)
            collected_this_month = db.execute(
                select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).select_from(PaymentAllocation)
                .join(Receipt, Receipt.id == PaymentAllocation.receipt_id)
                .where(PaymentAllocation.invoice_id.in_(invoice_ids), Receipt.receipt_date >= month_start)
            ).scalar_one()
            collected_today = db.execute(
                select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).select_from(PaymentAllocation)
                .join(Receipt, Receipt.id == PaymentAllocation.receipt_id)
                .where(PaymentAllocation.invoice_id.in_(invoice_ids), Receipt.receipt_date == today)
            ).scalar_one()

            # Overdue = a real FeeStructureItem due_date already passed
            # for that invoice's lines AND a real outstanding balance
            # remains -- batched (candidate ids, then one grouped
            # allocation query, then one totals query), never a
            # per-invoice loop.
            overdue_candidates_stmt = (
                select(FeeInvoice.id, FeeInvoice.invoice_id)
                .join(FeeInvoiceLine, FeeInvoiceLine.fee_invoice_id == FeeInvoice.id)
                .join(FeeStructureItem, FeeStructureItem.id == FeeInvoiceLine.fee_structure_item_id)
                .where(FeeInvoice.id.in_(fee_invoice_ids))
                .group_by(FeeInvoice.id, FeeInvoice.invoice_id)
                .having(func.min(FeeStructureItem.due_date) < today)
            )
            overdue_rows = db.execute(overdue_candidates_stmt).all()
            overdue_invoice_ids = [r[1] for r in overdue_rows]
            if overdue_invoice_ids:
                allocated_map = dict(db.execute(
                    select(PaymentAllocation.invoice_id, func.coalesce(func.sum(PaymentAllocation.amount), 0))
                    .where(PaymentAllocation.invoice_id.in_(overdue_invoice_ids)).group_by(PaymentAllocation.invoice_id)
                ).all())
                totals_map = dict(db.execute(select(Invoice.id, Invoice.total).where(Invoice.id.in_(overdue_invoice_ids))).all())
                overdue_accounts = sum(
                    1 for iid in overdue_invoice_ids if totals_map.get(iid, Decimal(0)) - allocated_map.get(iid, Decimal(0)) > 0
                )

        outstanding_total = invoiced_total - collected_total
        collection_rate_pct = round(float(collected_total) / float(invoiced_total) * 100, 1) if invoiced_total else None

        fee_snapshot = {
            "collected_today": collected_today, "collected_this_month": collected_this_month,
            "outstanding_total": outstanding_total, "overdue_accounts": overdue_accounts, "collection_rate_pct": collection_rate_pct,
        }
        kpis["fees_collected_this_month"] = collected_this_month
        kpis["fees_outstanding_total"] = outstanding_total
        kpis["overdue_fee_accounts"] = overdue_accounts

        if overdue_accounts:
            needs_attention.append({
                "key": "fees_overdue", "label": "Fee accounts overdue", "count": overdue_accounts, "href": "/fees", "severity": "high",
            })

    # ----------------------------------------------------------- Staff
    staff_snapshot = None
    present_today = None
    on_leave_today = None
    pending_leave_approvals = None

    if "attendance.view" in perms:
        present_stmt = select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.attendance_date == today, AttendanceRecord.status == "present"
        )
        if branch_id:
            present_stmt = present_stmt.join(Employee, Employee.id == AttendanceRecord.employee_id).where(Employee.branch_id == branch_id)
        present_today = db.execute(present_stmt).scalar_one()
        kpis["staff_present_today"] = present_today

    if "leave.view" in perms:
        leave_today_stmt = select(func.count()).select_from(LeaveRequest).where(
            LeaveRequest.tenant_id == tenant_id, LeaveRequest.status == "approved", LeaveRequest.start_date <= today, LeaveRequest.end_date >= today
        )
        pending_leave_stmt = select(func.count()).select_from(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id, LeaveRequest.status == "pending")
        if branch_id:
            leave_today_stmt = leave_today_stmt.join(Employee, Employee.id == LeaveRequest.employee_id).where(Employee.branch_id == branch_id)
            pending_leave_stmt = pending_leave_stmt.join(Employee, Employee.id == LeaveRequest.employee_id).where(Employee.branch_id == branch_id)
        on_leave_today = db.execute(leave_today_stmt).scalar_one()
        pending_leave_approvals = db.execute(pending_leave_stmt).scalar_one()

        if pending_leave_approvals:
            needs_attention.append({
                "key": "leave_pending", "label": "Staff leave requests awaiting approval",
                "count": pending_leave_approvals, "href": "/people/leave", "severity": "medium",
            })

    if "attendance.view" in perms or "leave.view" in perms:
        staff_snapshot = {"present_today": present_today, "on_leave_today": on_leave_today, "pending_leave_approvals": pending_leave_approvals}

    # -------------------------------------------------------- Academic
    academic_snapshot = None
    classes_scheduled_today = None
    exams_upcoming = None
    pending_marks_entry = None
    homework_pending = None

    if "timetable.view" in perms:
        classes_stmt = (
            select(func.count()).select_from(TimetableEntry)
            .join(Section, Section.id == TimetableEntry.section_id)
            .join(SchoolClass, SchoolClass.id == Section.school_class_id)
            .where(TimetableEntry.tenant_id == tenant_id, TimetableEntry.day_of_week == today.weekday())
        )
        if branch_id:
            classes_stmt = classes_stmt.where(SchoolClass.branch_id == branch_id)
        classes_scheduled_today = db.execute(classes_stmt).scalar_one()

    if "examinations.view" in perms and year is not None:
        upcoming_window = today + timedelta(days=UPCOMING_EXAM_WINDOW_DAYS)
        exams_upcoming = db.execute(
            select(func.count()).select_from(Examination).where(
                Examination.tenant_id == tenant_id, Examination.academic_year_id == year.id,
                Examination.start_date >= today, Examination.start_date <= upcoming_window,
            )
        ).scalar_one()
        pending_marks_entry = db.execute(
            select(func.count()).select_from(Examination).where(
                Examination.tenant_id == tenant_id, Examination.academic_year_id == year.id,
                Examination.is_locked.is_(False), Examination.end_date < today,
            )
        ).scalar_one()
        if pending_marks_entry:
            needs_attention.append({
                "key": "marks_pending", "label": "Examinations awaiting marks entry", "count": pending_marks_entry, "href": "/examinations", "severity": "medium",
            })

    if "homework.view" in perms:
        hw_stmt = (
            select(func.count()).select_from(HomeworkSubmission)
            .join(Homework, Homework.id == HomeworkSubmission.homework_id)
            .where(HomeworkSubmission.tenant_id == tenant_id, HomeworkSubmission.status == "pending", Homework.due_date < today)
        )
        if branch_id:
            hw_stmt = hw_stmt.join(Section, Section.id == Homework.section_id).join(SchoolClass, SchoolClass.id == Section.school_class_id).where(SchoolClass.branch_id == branch_id)
        homework_pending = db.execute(hw_stmt).scalar_one()
        if homework_pending:
            needs_attention.append({
                "key": "homework_overdue", "label": "Homework submissions overdue and unmarked",
                "count": homework_pending, "href": "/homework", "severity": "low",
            })

    if "timetable.view" in perms or "examinations.view" in perms or "homework.view" in perms:
        academic_snapshot = {
            "classes_scheduled_today": classes_scheduled_today, "exams_upcoming": exams_upcoming,
            "pending_marks_entry": pending_marks_entry, "homework_pending": homework_pending,
        }

    # ------------------------------------------------------ Approvals
    if "approvals.view" in perms:
        pending_approvals = db.execute(
            select(func.count()).select_from(ApprovalRequest).where(ApprovalRequest.tenant_id == tenant_id, ApprovalRequest.status == "pending")
        ).scalar_one()
        if pending_approvals:
            needs_attention.append({
                "key": "approvals_pending", "label": "Pending administrative approvals", "count": pending_approvals, "href": "/approvals", "severity": "medium",
            })

    # --------------------------------------------------- Today's schedule
    today_schedule: list[dict] = []
    if "examinations.view" in perms:
        exam_today_stmt = (
            select(Examination.name, Subject.name, SchoolClass.name)
            .select_from(ExamSubjectSchedule)
            .join(Examination, Examination.id == ExamSubjectSchedule.examination_id)
            .join(Subject, Subject.id == ExamSubjectSchedule.subject_id)
            .join(SchoolClass, SchoolClass.id == ExamSubjectSchedule.school_class_id)
            .where(ExamSubjectSchedule.tenant_id == tenant_id, ExamSubjectSchedule.exam_date == today)
        )
        if branch_id:
            exam_today_stmt = exam_today_stmt.where(SchoolClass.branch_id == branch_id)
        for exam_name, subject_name, class_name in db.execute(exam_today_stmt).all():
            today_schedule.append({"time": None, "title": f"{exam_name}: {subject_name}", "category": "exam", "detail": class_name})

    if "timetable.view" in perms:
        periods_stmt = (
            select(TimetableSlot.start_time, Subject.name, SchoolClass.name, Section.name)
            .select_from(TimetableEntry)
            .join(TimetableSlot, TimetableSlot.id == TimetableEntry.slot_id)
            .join(Subject, Subject.id == TimetableEntry.subject_id)
            .join(Section, Section.id == TimetableEntry.section_id)
            .join(SchoolClass, SchoolClass.id == Section.school_class_id)
            .where(TimetableEntry.tenant_id == tenant_id, TimetableEntry.day_of_week == today.weekday())
            .order_by(TimetableSlot.start_time)
            .limit(TODAY_SCHEDULE_PERIOD_LIMIT)
        )
        if branch_id:
            periods_stmt = periods_stmt.where(SchoolClass.branch_id == branch_id)
        for start_time, subject_name, class_name, section_name in db.execute(periods_stmt).all():
            today_schedule.append({"time": start_time.strftime("%H:%M"), "title": subject_name, "category": "class", "detail": f"{class_name} - {section_name}"})

    today_schedule.sort(key=lambda item: (0 if item["time"] is None else 1, item["time"] or ""))

    return {
        "as_of": today.isoformat(),
        "kpis": kpis,
        "fees": fee_snapshot,
        "staff": staff_snapshot,
        "academic": academic_snapshot,
        "admissions_pipeline": admissions_summary,
        "needs_attention": needs_attention,
        "today_schedule": today_schedule,
        "today_schedule_total_classes": classes_scheduled_today,
    }
