from decimal import Decimal

from pydantic import BaseModel


class SchoolDashboardKPIsOut(BaseModel):
    """Every field is independently nullable -- null means "you don't
    hold the real permission for this domain" (see deps.user_permission_
    codes), never a fabricated zero standing in for missing access."""

    total_active_students: int | None
    new_enquiries_this_week: int | None
    pending_admissions: int | None
    students_absent_today: int | None
    fees_collected_this_month: Decimal | None
    fees_outstanding_total: Decimal | None
    overdue_fee_accounts: int | None
    staff_present_today: int | None


class SchoolDashboardFeeSnapshotOut(BaseModel):
    collected_today: Decimal
    collected_this_month: Decimal
    outstanding_total: Decimal
    overdue_accounts: int
    collection_rate_pct: float | None


class SchoolDashboardStaffSnapshotOut(BaseModel):
    present_today: int | None
    on_leave_today: int | None
    pending_leave_approvals: int | None


class SchoolDashboardAcademicSnapshotOut(BaseModel):
    classes_scheduled_today: int | None
    exams_upcoming: int | None
    pending_marks_entry: int | None
    homework_pending: int | None


class SchoolDashboardAdmissionsPipelineOut(BaseModel):
    total_enquiries: int
    new_enquiries: int
    follow_ups_due_today: int
    overdue_follow_ups: int
    applications_started: int
    converted: int
    conversion_rate_pct: float | None
    pipeline: dict[str, int]


class NeedsAttentionItemOut(BaseModel):
    key: str
    label: str
    count: int
    href: str
    severity: str  # "high" | "medium" | "low"


class TodayScheduleItemOut(BaseModel):
    time: str | None  # HH:MM, or null for an all-day item (an exam)
    title: str
    category: str  # "exam" | "class"
    detail: str | None


class SchoolDashboardSummaryOut(BaseModel):
    as_of: str
    kpis: SchoolDashboardKPIsOut
    fees: SchoolDashboardFeeSnapshotOut | None
    staff: SchoolDashboardStaffSnapshotOut | None
    academic: SchoolDashboardAcademicSnapshotOut | None
    admissions_pipeline: SchoolDashboardAdmissionsPipelineOut | None
    needs_attention: list[NeedsAttentionItemOut]
    today_schedule: list[TodayScheduleItemOut]
    today_schedule_total_classes: int | None
