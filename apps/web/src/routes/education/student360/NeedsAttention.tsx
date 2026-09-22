import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ATTENDANCE_ALERT_THRESHOLD_PCT, type AttendanceRecord, type FeeInvoiceSummary, type Guardian, type StudentGuardianLink, type StudentHomeworkEntry } from "./types";

interface Alert {
  key: string;
  title: string;
  detail: string;
  severity: "critical" | "warning";
  date: string | null;
  onAction: () => void;
  actionLabel: string;
}

/** Every alert here is computed from real, already-fetched data -- no
 * generic "things to check" boilerplate. An alert type with no real
 * underlying signal in this codebase yet (report-card approval,
 * transport-missing, medical-info-incomplete) is deliberately left out
 * rather than firing a warning nobody can act on -- see the ADR. */
export function NeedsAttention({
  feeInvoices, attendance, homeworkEntries, guardianLinks, guardianById, onGoToTab,
}: {
  feeInvoices: FeeInvoiceSummary[] | undefined;
  attendance: AttendanceRecord[] | undefined;
  homeworkEntries: StudentHomeworkEntry[] | undefined;
  guardianLinks: StudentGuardianLink[] | undefined;
  guardianById: Map<string, Guardian>;
  onGoToTab: (tab: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const alerts: Alert[] = [];

  const overdueInvoices = (feeInvoices ?? []).filter((inv) => Number(inv.outstanding) > 0 && inv.due_date && inv.due_date < today);
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.outstanding), 0);
    const earliest = overdueInvoices.reduce((a, b) => (a.due_date! < b.due_date! ? a : b));
    alerts.push({
      key: "fee-overdue", title: "Fee instalment overdue", detail: `₹${totalOverdue.toLocaleString("en-IN")} outstanding`,
      severity: "critical", date: earliest.due_date, actionLabel: "View fees", onAction: () => onGoToTab("fees"),
    });
  }

  if (attendance && attendance.length > 0) {
    const pct = Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100);
    if (pct < ATTENDANCE_ALERT_THRESHOLD_PCT) {
      alerts.push({
        key: "attendance-low", title: "Attendance below threshold", detail: `${pct}% present (below ${ATTENDANCE_ALERT_THRESHOLD_PCT}%)`,
        severity: "warning", date: null, actionLabel: "View attendance", onAction: () => onGoToTab("attendance"),
      });
    }
  }

  const overdueHomework = (homeworkEntries ?? []).filter((e) => e.status === "pending" && e.homework.due_date < today);
  if (overdueHomework.length > 0) {
    alerts.push({
      key: "homework-overdue", title: `${overdueHomework.length} assignment${overdueHomework.length === 1 ? "" : "s"} overdue`,
      detail: overdueHomework.slice(0, 2).map((e) => e.homework.title).join(", ") + (overdueHomework.length > 2 ? "..." : ""),
      severity: "warning", date: overdueHomework[0].homework.due_date, actionLabel: "View homework", onAction: () => onGoToTab("homework"),
    });
  }

  if (guardianLinks && guardianLinks.length === 0) {
    alerts.push({
      key: "no-guardian", title: "No guardian linked", detail: "This student has no guardian on file yet",
      severity: "critical", date: null, actionLabel: "Add guardian", onAction: () => onGoToTab("guardians"),
    });
  } else if (guardianLinks) {
    const primary = guardianLinks.find((l) => l.is_primary_contact);
    const primaryGuardian = primary ? guardianById.get(primary.guardian_id) : null;
    if (primary && primaryGuardian && !primaryGuardian.user_id) {
      alerts.push({
        key: "portal-inactive", title: "Parent portal not activated", detail: `${primaryGuardian.full_name} has no portal login yet`,
        severity: "warning", date: null, actionLabel: "Set up access", onAction: () => onGoToTab("guardians"),
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Needs attention</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {alerts.map((a) => (
          <div
            key={a.key}
            className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${a.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="truncate text-xs text-muted-foreground">{a.detail}{a.date ? ` · Due ${a.date}` : ""}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={a.onAction}>{a.actionLabel}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
