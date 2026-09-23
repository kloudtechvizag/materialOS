export interface Enquiry {
  id: string;
  branch_id: string;
  student_name: string;
  date_of_birth: string | null;
  desired_grade: string | null;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  source: string | null;
  status: string;
  follow_up_date: string | null;
  notes: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  has_application: boolean;
  created_at: string;
}

export interface EnquiryActivity {
  id: string;
  enquiry_id: string;
  activity_type: string;
  description: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface DuplicateCandidate {
  id: string;
  student_name: string;
  guardian_name: string;
  guardian_phone: string | null;
  status: string;
  created_at: string;
}

export interface AdmissionsSummary {
  total_enquiries: number;
  new_enquiries: number;
  follow_ups_due_today: number;
  overdue_follow_ups: number;
  applications_started: number;
  converted: number;
  conversion_rate_pct: number | null;
  pipeline: Record<string, number>;
}

export interface AcademicYear {
  id: string;
  is_current: boolean;
}

export interface Branch {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Not proceeding",
};

export const STATUS_BADGE_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  open: "outline",
  contacted: "secondary",
  converted: "success",
  closed: "destructive",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  created: "Enquiry logged",
  note: "Note",
  call: "Call",
  status_change: "Status change",
  follow_up_scheduled: "Follow-up scheduled",
};

export function employeeName(e: Employee): string {
  return `${e.first_name} ${e.last_name}`.trim();
}

export function followUpUrgency(enquiry: Enquiry, today: string): "overdue" | "today" | "upcoming" | "none" {
  if (!enquiry.follow_up_date || enquiry.status === "converted" || enquiry.status === "closed") return "none";
  if (enquiry.follow_up_date < today) return "overdue";
  if (enquiry.follow_up_date === today) return "today";
  return "upcoming";
}
