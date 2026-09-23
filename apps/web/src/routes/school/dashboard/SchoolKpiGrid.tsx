import { Kpi } from "@/components/dashboard/Kpi";
import { formatINRCompact } from "@/lib/format";

import type { SchoolDashboardKPIs } from "./types";

/** A null field means "you don't hold that real permission" -- shown
 * as an honest "—", never a fabricated 0. `hint` only ever carries a
 * real, backend-derived status, never an invented trend/percentage. */
export function SchoolKpiGrid({ kpis }: { kpis: SchoolDashboardKPIs }) {
  const val = (n: number | null) => (n === null ? "—" : String(n));
  const money = (n: string | null) => (n === null ? "—" : formatINRCompact(n));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Active students" value={val(kpis.total_active_students)} to="/students" />
      <Kpi label="New enquiries (7d)" value={val(kpis.new_enquiries_this_week)} to="/admission-enquiries" />
      <Kpi
        label="Pending admissions"
        value={val(kpis.pending_admissions)}
        to="/admission-applications"
        hint={kpis.pending_admissions ? "Awaiting review" : undefined}
        hintTone={kpis.pending_admissions ? "warning" : "muted"}
      />
      <Kpi
        label="Absent today"
        value={val(kpis.students_absent_today)}
        to="/student-attendance"
        hint={kpis.students_absent_today ? "Review attendance" : undefined}
        hintTone={kpis.students_absent_today ? "warning" : "muted"}
      />
      <Kpi label="Fees collected (month)" value={money(kpis.fees_collected_this_month)} to="/fees" />
      <Kpi label="Fees outstanding" value={money(kpis.fees_outstanding_total)} to="/fees" />
      <Kpi
        label="Overdue fee accounts"
        value={val(kpis.overdue_fee_accounts)}
        to="/fees"
        hint={kpis.overdue_fee_accounts ? "Needs follow-up" : kpis.overdue_fee_accounts === 0 ? "All current" : undefined}
        hintTone={kpis.overdue_fee_accounts ? "warning" : "positive"}
      />
      <Kpi label="Staff present today" value={val(kpis.staff_present_today)} to="/people/attendance" />
    </div>
  );
}
