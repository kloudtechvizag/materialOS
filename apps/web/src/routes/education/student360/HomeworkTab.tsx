import { useQuery } from "@tanstack/react-query";
import { FilePenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, downloadAuthenticatedFile } from "@/lib/api";
import type { StudentHomeworkEntry } from "./types";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive" | "warning"> = {
  pending: "outline", submitted: "success", late: "warning", missing: "destructive",
};

export function HomeworkTab({ studentId }: { studentId: string }) {
  const { data: entries, isLoading, error } = useQuery({
    queryKey: ["student-homework", studentId],
    queryFn: () => apiFetch<StudentHomeworkEntry[]>(`/students/${studentId}/homework`),
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error) return <p className="text-sm text-destructive">Could not load homework.</p>;
  if (!entries || entries.length === 0) {
    return <EmptyState icon={FilePenLine} title="No homework assigned yet" description="Assignments given to this student's section will appear here." />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const groups: Record<string, StudentHomeworkEntry[]> = { overdue: [], pending: [], submitted: [], late: [], missing: [] };
  for (const e of entries) {
    if (e.status === "pending" && e.homework.due_date < today) groups.overdue.push(e);
    else groups[e.status]?.push(e);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Pending" value={groups.pending.length} />
        <StatTile label="Overdue" value={groups.overdue.length} tone="destructive" />
        <StatTile label="Submitted" value={groups.submitted.length + groups.late.length} tone="success" />
        <StatTile label="Missing" value={groups.missing.length} tone="destructive" />
      </div>

      <div className="space-y-2">
        {[...groups.overdue, ...groups.pending, ...groups.late, ...groups.submitted, ...groups.missing].map((e) => (
          <div key={e.homework.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{e.homework.title}</p>
              <p className="text-xs text-muted-foreground">
                Assigned {e.homework.assigned_date} · Due {e.homework.due_date}
                {e.homework.attachment_file_name && (
                  <>
                    {" · "}
                    <button type="button" className="text-primary hover:underline" onClick={() => downloadAuthenticatedFile(`/homework/${e.homework.id}/attachment`, e.homework.attachment_file_name!)}>
                      {e.homework.attachment_file_name}
                    </button>
                  </>
                )}
              </p>
            </div>
            <Badge variant={e.homework.due_date < today && e.status === "pending" ? "destructive" : STATUS_VARIANT[e.status] ?? "outline"}>
              {e.homework.due_date < today && e.status === "pending" ? "Overdue" : e.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "destructive" | "success" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${tone === "destructive" ? "text-destructive" : tone === "success" ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  );
}
