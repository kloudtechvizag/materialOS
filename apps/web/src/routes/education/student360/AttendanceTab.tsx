import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { AttendanceRecord } from "./types";

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-500", absent: "bg-destructive", late: "bg-amber-500",
  half_day: "bg-sky-500", excused: "bg-violet-500", on_leave: "bg-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  present: "Present", absent: "Absent", late: "Late", half_day: "Half day", excused: "Excused", on_leave: "On leave",
};

function longestAbsenceStreak(sorted: AttendanceRecord[]): number {
  let longest = 0, current = 0;
  for (const r of sorted) {
    if (r.status === "absent") { current += 1; longest = Math.max(longest, current); } else { current = 0; }
  }
  return longest;
}

export function AttendanceTab({ studentId }: { studentId: string }) {
  const { data: attendance, isLoading, error } = useQuery({
    queryKey: ["student-attendance-history", studentId],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/student-attendance?student_id=${studentId}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <p className="text-sm text-destructive">Could not load attendance.</p>;
  if (!attendance || attendance.length === 0) {
    return <EmptyState icon={CalendarDays} title="No attendance recorded yet" description="Once attendance is marked for this student's section, it will appear here." />;
  }

  const sorted = [...attendance].sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
  const total = sorted.length;
  const counts = sorted.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  const presentLike = (counts.present ?? 0) + (counts.half_day ?? 0);
  const pct = Math.round((presentLike / total) * 100);
  const streak = longestAbsenceStreak(sorted);
  const lateCount = counts.late ?? 0;

  // Group into months for a real calendar grid, not a decorative one.
  const byMonth = new Map<string, AttendanceRecord[]>();
  for (const r of sorted) {
    const month = r.attendance_date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(r);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Attendance" value={`${pct}%`} />
        <StatTile label="Present" value={String(counts.present ?? 0)} />
        <StatTile label="Absent" value={String(counts.absent ?? 0)} />
        <StatTile label="Late" value={String(lateCount)} />
      </div>
      {streak >= 3 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          Longest absence streak: <span className="font-medium">{streak} consecutive days</span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recorded days by month</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {months.map(([month, records]) => (
            <div key={month}>
              <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">{new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
              <div className="flex flex-wrap gap-1.5">
                {records.map((r) => (
                  <span
                    key={r.id}
                    title={`${r.attendance_date}: ${STATUS_LABEL[r.status] ?? r.status}`}
                    className={`flex h-7 w-7 items-center justify-center rounded text-[10px] font-medium text-white ${STATUS_COLOR[r.status] ?? "bg-muted-foreground"}`}
                  >
                    {r.attendance_date.slice(-2)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Period-wise attendance and correction-request approval workflows aren't built yet -- attendance is recorded per day, per section, by staff directly.
      </p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
