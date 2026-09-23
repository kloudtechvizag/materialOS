export interface SchoolDashboardKPIs {
  total_active_students: number | null;
  new_enquiries_this_week: number | null;
  pending_admissions: number | null;
  students_absent_today: number | null;
  fees_collected_this_month: string | null;
  fees_outstanding_total: string | null;
  overdue_fee_accounts: number | null;
  staff_present_today: number | null;
}

export interface SchoolDashboardFeeSnapshot {
  collected_today: string;
  collected_this_month: string;
  outstanding_total: string;
  overdue_accounts: number;
  collection_rate_pct: number | null;
}

export interface SchoolDashboardStaffSnapshot {
  present_today: number | null;
  on_leave_today: number | null;
  pending_leave_approvals: number | null;
}

export interface SchoolDashboardAcademicSnapshot {
  classes_scheduled_today: number | null;
  exams_upcoming: number | null;
  pending_marks_entry: number | null;
  homework_pending: number | null;
}

export interface SchoolDashboardAdmissionsPipeline {
  total_enquiries: number;
  new_enquiries: number;
  follow_ups_due_today: number;
  overdue_follow_ups: number;
  applications_started: number;
  converted: number;
  conversion_rate_pct: number | null;
  pipeline: Record<string, number>;
}

export interface NeedsAttentionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  severity: "high" | "medium" | "low";
}

export interface TodayScheduleItem {
  time: string | null;
  title: string;
  category: "exam" | "class";
  detail: string | null;
}

export interface SchoolDashboardSummary {
  as_of: string;
  kpis: SchoolDashboardKPIs;
  fees: SchoolDashboardFeeSnapshot | null;
  staff: SchoolDashboardStaffSnapshot | null;
  academic: SchoolDashboardAcademicSnapshot | null;
  admissions_pipeline: SchoolDashboardAdmissionsPipeline | null;
  needs_attention: NeedsAttentionItem[];
  today_schedule: TodayScheduleItem[];
  today_schedule_total_classes: number | null;
}

export const PIPELINE_STAGE_LABEL: Record<string, string> = {
  open: "Open",
  contacted: "Contacted",
  application_started: "Application started",
  converted: "Converted",
  closed: "Not proceeding",
};
