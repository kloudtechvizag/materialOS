import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { AuditLogEntry, FeeInvoiceSummary, Guardian, StudentEnrolment, StudentGuardianLink, StudentHomeworkEntry } from "./types";
import { buildTimelineEvents, type TimelineCategory } from "./timelineEvents";

const CATEGORY_LABEL: Record<TimelineCategory, string> = {
  academic: "Academic", attendance: "Attendance", finance: "Finance", administration: "Administration",
};

export function TimelineTab({
  studentId, enrolments, feeInvoices, homeworkEntries, guardianLinks, guardianById,
}: {
  studentId: string;
  enrolments: StudentEnrolment[] | undefined;
  feeInvoices: FeeInvoiceSummary[] | undefined;
  homeworkEntries: StudentHomeworkEntry[] | undefined;
  guardianLinks: StudentGuardianLink[] | undefined;
  guardianById: Map<string, Guardian>;
}) {
  const [filter, setFilter] = useState<TimelineCategory | "all">("all");

  // Real audit history for this exact student row -- the same
  // /audit-logs endpoint the generic Audit Log page uses, filtered
  // here to row_id so it reads as this student's own history rather
  // than sending staff to an unfiltered, tenant-wide page.
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["student-audit-logs", studentId],
    queryFn: () => apiFetch<AuditLogEntry[]>(`/audit-logs?table_name=students&row_id=${studentId}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  const events = buildTimelineEvents({ enrolments, feeInvoices, homeworkEntries, guardianLinks, guardianById, auditLogs });
  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All</FilterPill>
        {(Object.keys(CATEGORY_LABEL) as TimelineCategory[]).map((c) => (
          <FilterPill key={c} active={filter === c} onClick={() => setFilter(c)}>{CATEGORY_LABEL[c]}</FilterPill>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={History} title="No timeline events yet" description="As attendance, fees, homework, and enrolment activity happen, they'll appear here in order." />
      )}

      <div className="space-y-0">
        {filtered.map((ev, i) => (
          <div key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              {i < filtered.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="pb-4">
              <p className="text-xs text-muted-foreground">{ev.date}</p>
              <p className="text-sm font-medium">{ev.title}</p>
              <p className="text-sm text-muted-foreground">{ev.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-primary bg-accent" : "border-input text-muted-foreground hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}
