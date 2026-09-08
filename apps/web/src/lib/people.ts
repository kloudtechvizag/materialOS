export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  date_of_birth: string | null;
  joining_date: string;
  employment_type: string;
  status: string;
  company_id: string;
  branch_id: string;
  department_id: string | null;
  designation_id: string | null;
  reporting_manager_id: string | null;
  shift_id: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Designation {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
  is_night_shift: boolean;
  is_active: boolean;
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full time", part_time: "Part time", contract: "Contract", temporary: "Temporary",
  intern: "Intern", apprentice: "Apprentice", consultant: "Consultant", daily_wage: "Daily wage",
  hourly: "Hourly", commission_based: "Commission based", freelancer: "Freelancer",
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: "Active", probation: "Probation", on_notice: "On notice", on_leave: "On leave",
  suspended: "Suspended", inactive: "Inactive", resigned: "Resigned", terminated: "Terminated", retired: "Retired",
};

export function employeeName(e: Employee): string {
  return `${e.first_name} ${e.last_name}`;
}
