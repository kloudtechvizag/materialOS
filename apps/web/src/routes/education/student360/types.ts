// Student 360 -- shared types across the header, KPI strip, Needs
// Attention panel, and every tab. One file so each tab doesn't
// redeclare the same shape with tiny drifts (a real bug class this
// codebase has hit before when interfaces were copy-pasted per page).

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  previous_school: string | null;
  admission_date: string;
  category: string | null;
  status: string;
  company_id: string;
  branch_id: string;
}

export interface Branch {
  id: string;
  name: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  academic_year_id: string;
  branch_id: string;
  sequence: number;
}

export interface Section {
  id: string;
  name: string;
  school_class_id: string;
  class_teacher_id: string | null;
  capacity: number | null;
}

export interface StudentEnrolment {
  id: string;
  academic_year_id: string;
  school_class_id: string;
  section_id: string | null;
  roll_number: string | null;
  status: string;
  enrolment_date: string;
}

export interface Guardian {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  user_id: string | null;
}

export interface StudentGuardianLink {
  id: string;
  guardian_id: string;
  relationship_type: string;
  is_primary_contact: boolean;
}

export interface AttendanceRecord {
  id: string;
  attendance_date: string;
  status: string;
}

export interface Examination {
  id: string;
  academic_year_id: string;
  name: string;
  is_locked: boolean;
  start_date: string;
  end_date: string;
}

export interface ReportCardSubject {
  subject_id: string;
  subject_name: string;
  max_marks: string;
  pass_marks: string;
  marks_obtained: string | null;
  is_absent: boolean;
  is_pass: boolean | null;
  grade: string | null;
}

export interface ReportCard {
  subjects: ReportCardSubject[];
  total_marks_obtained: string;
  total_max_marks: string;
  percentage: string | null;
  overall_grade: string | null;
  overall_result: string;
}

export interface StudentHomeworkEntry {
  homework: { id: string; title: string; due_date: string; assigned_date: string; attachment_file_name: string | null };
  status: string;
}

export interface FeeInvoiceSummary {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  total: string;
  outstanding: string;
  due_date: string | null;
}

export interface StudentTransport {
  route_name: string;
  vehicle_registration_number: string;
  driver_name: string;
  driver_phone: string | null;
  stop_name: string;
  pickup_time: string;
  drop_time: string;
}

export interface LibraryIssue {
  id: string;
  book_title: string;
  accession_number: string;
  issued_date: string;
  due_date: string;
  returned_date: string | null;
  status: string;
  fine_amount: string;
  is_overdue: boolean;
}

export interface StudentHostel {
  hostel_name: string;
  room_number: string;
  bed_number: number;
  warden_name: string | null;
  warden_phone: string | null;
}

export interface AuditLogEntry {
  id: string;
  table_name: string;
  row_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_user_id: string | null;
  occurred_at: string;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export const STATUS_LABELS: Record<string, string> = {
  active: "Active", transferred: "Transferred", withdrawn: "Withdrawn", alumni: "Alumni", inactive: "Inactive",
};

// A tenant-configurable attendance threshold doesn't exist yet
// (models/notifications.py's NotificationRule threshold_value is the
// closest real mechanism, but no rule targets attendance specifically)
// -- this default is named here, once, rather than a magic number
// scattered across the header/KPI/Needs Attention/Attendance tab.
export const ATTENDANCE_ALERT_THRESHOLD_PCT = 75;
