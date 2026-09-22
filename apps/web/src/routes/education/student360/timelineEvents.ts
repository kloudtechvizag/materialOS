// Shared by OverviewTab (last 3) and TimelineTab (full, filterable) --
// one real event-synthesis function so both stay consistent, built
// entirely from data the rest of Student 360 already fetches. No
// event here is invented: each one corresponds to a real row this
// vertical already writes (StudentEnrolment, AttendanceRecord,
// FeeInvoiceSummary + a Receipt implied by outstanding change isn't
// directly visible here so fee events use invoice creation/paid state,
// StudentHomeworkEntry, ReportCard-per-exam lock state, AuditLog for
// guardian/status changes).

import type {
  AuditLogEntry, FeeInvoiceSummary, Guardian, StudentEnrolment, StudentGuardianLink, StudentHomeworkEntry,
} from "./types";

export type TimelineCategory = "academic" | "attendance" | "finance" | "administration";

export interface TimelineEvent {
  id: string;
  date: string; // ISO date, for sorting
  category: TimelineCategory;
  title: string;
  detail: string;
}

export function buildTimelineEvents(args: {
  enrolments?: StudentEnrolment[];
  feeInvoices?: FeeInvoiceSummary[];
  homeworkEntries?: StudentHomeworkEntry[];
  guardianLinks?: StudentGuardianLink[];
  guardianById?: Map<string, Guardian>;
  auditLogs?: AuditLogEntry[];
  classNameByEnrolmentId?: Map<string, string>;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const e of args.enrolments ?? []) {
    events.push({
      id: `enrol-${e.id}`, date: e.enrolment_date, category: "academic",
      title: "Enrolled", detail: args.classNameByEnrolmentId?.get(e.id) ?? "New academic year enrolment",
    });
  }

  for (const inv of args.feeInvoices ?? []) {
    events.push({
      id: `fee-${inv.id}`, date: inv.invoice_date, category: "finance",
      title: "Fee invoice generated", detail: `${inv.invoice_number} · ₹${Number(inv.total).toLocaleString("en-IN")}`,
    });
    if (Number(inv.outstanding) <= 0) {
      events.push({
        id: `fee-paid-${inv.id}`, date: inv.invoice_date, category: "finance",
        title: "Fee invoice fully paid", detail: inv.invoice_number,
      });
    }
  }

  for (const entry of args.homeworkEntries ?? []) {
    if (entry.status === "submitted" || entry.status === "late") {
      events.push({
        id: `hw-${entry.homework.id}`, date: entry.homework.due_date, category: "academic",
        title: entry.status === "late" ? "Assignment submitted late" : "Assignment submitted", detail: entry.homework.title,
      });
    }
  }

  for (const link of args.guardianLinks ?? []) {
    const g = args.guardianById?.get(link.guardian_id);
    events.push({
      id: `guardian-${link.id}`, date: "", category: "administration",
      title: "Guardian linked", detail: `${g?.full_name ?? "Guardian"} (${link.relationship_type})`,
    });
  }

  for (const log of args.auditLogs ?? []) {
    if (log.action === "UPDATE" && log.old_data && log.new_data && log.old_data.status !== log.new_data.status) {
      events.push({
        id: `status-${log.id}`, date: log.occurred_at.slice(0, 10), category: "administration",
        title: "Status changed", detail: `${log.old_data.status} → ${log.new_data.status}`,
      });
    }
    if (log.action === "INSERT") {
      events.push({
        id: `created-${log.id}`, date: log.occurred_at.slice(0, 10), category: "administration",
        title: "Student record created", detail: "Admission recorded",
      });
    }
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
