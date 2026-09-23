import { Link } from "react-router-dom";

import type { SchoolDashboardAcademicSnapshot, SchoolDashboardStaffSnapshot } from "./types";

function Stat({ label, value, href, tone }: { label: string; value: number | null; href: string; tone?: "warning" }) {
  return (
    <Link to={href} className="flex flex-col gap-0.5 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-accent/40">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-base font-semibold ${tone === "warning" && value ? "text-amber-600 dark:text-amber-400" : ""}`}>{value ?? "—"}</span>
    </Link>
  );
}

export function SchoolAcademicSnapshot({ academic, isLoading }: { academic: SchoolDashboardAcademicSnapshot | null | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Academics</p>
      {isLoading && <div className="h-20 animate-pulse rounded-md bg-muted" />}
      {!isLoading && !academic && <p className="text-sm text-muted-foreground">You don&apos;t have permission to view academic data.</p>}
      {!isLoading && academic && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Classes today" value={academic.classes_scheduled_today} href="/timetable" />
          <Stat label="Exams upcoming" value={academic.exams_upcoming} href="/examinations" />
          <Stat label="Marks entry pending" value={academic.pending_marks_entry} href="/examinations" tone="warning" />
          <Stat label="Homework overdue" value={academic.homework_pending} href="/homework" tone="warning" />
        </div>
      )}
    </div>
  );
}

export function SchoolStaffSnapshot({ staff, isLoading }: { staff: SchoolDashboardStaffSnapshot | null | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Staff & operations</p>
      {isLoading && <div className="h-20 animate-pulse rounded-md bg-muted" />}
      {!isLoading && !staff && <p className="text-sm text-muted-foreground">You don&apos;t have permission to view staff data.</p>}
      {!isLoading && staff && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Present today" value={staff.present_today} href="/people/attendance" />
          <Stat label="On leave today" value={staff.on_leave_today} href="/people/leave" />
          <Stat label="Leave awaiting approval" value={staff.pending_leave_approvals} href="/people/leave" tone="warning" />
        </div>
      )}
    </div>
  );
}
