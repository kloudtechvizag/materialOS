import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AcademicYear { id: string; name: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface RosterEntry { student_id: string; first_name: string; last_name: string; roll_number: string | null; status: string | null; }

const STATUSES = [
  { value: "present", label: "Present", tone: "success" },
  { value: "absent", label: "Absent", tone: "destructive" },
  { value: "late", label: "Late", tone: "warning" },
  { value: "half_day", label: "Half day", tone: "warning" },
  { value: "excused", label: "Excused", tone: "muted" },
  { value: "on_leave", label: "On leave", tone: "muted" },
] as const;

const TONE_CLASS: Record<string, string> = {
  success: "bg-emerald-600 text-white border-emerald-600",
  destructive: "bg-destructive text-destructive-foreground border-destructive",
  warning: "bg-amber-500 text-white border-amber-500",
  muted: "bg-muted-foreground text-white border-muted-foreground",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** One-tap class attendance (spec sec11): pick a real Section + date,
 * mark every currently-enrolled student, save the whole roster in one
 * bulk call. Every student defaults to "present" client-side only --
 * nothing is saved until "Save attendance" is pressed, so an
 * untouched roster never silently writes fake attendance. */
export function StudentAttendancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const activeYearId = academicYearId ?? years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;

  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const activeClassId = classId ?? classes?.[0]?.id ?? null;

  const { data: sections } = useQuery({
    queryKey: ["sections", activeClassId],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${activeClassId}`),
    enabled: !!activeClassId,
  });
  const activeSectionId = sectionId ?? sections?.[0]?.id ?? null;

  const { data: roster, isLoading, error, refetch } = useQuery({
    queryKey: ["attendance-roster", activeSectionId, date],
    queryFn: async () => {
      const rows = await apiFetch<RosterEntry[]>(`/student-attendance/roster?section_id=${activeSectionId}&attendance_date=${date}`);
      setMarks(Object.fromEntries(rows.map((r) => [r.student_id, r.status ?? "present"])));
      return rows;
    },
    enabled: !!activeSectionId,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/student-attendance/bulk", {
        method: "POST",
        body: { section_id: activeSectionId, attendance_date: date, records: Object.entries(marks).map(([student_id, status]) => ({ student_id, status })) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-roster", activeSectionId, date] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Student attendance</h1>
        <p className="text-sm text-muted-foreground">Daily attendance, marked per class section.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeYearId ?? ""} onChange={(e) => { setAcademicYearId(e.target.value); setClassId(null); setSectionId(null); }}>
          {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
        </select>
        <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeClassId ?? ""} onChange={(e) => { setClassId(e.target.value); setSectionId(null); }}>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeSectionId ?? ""} onChange={(e) => setSectionId(e.target.value)}>
          {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
        </select>
        <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {!activeSectionId && <p className="text-sm text-muted-foreground">Add a class and section first.</p>}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {roster && roster.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <CalendarCheck className="h-4 w-4" />
          <span>No students enrolled in this section yet.</span>
        </div>
      )}

      {roster && roster.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Roll</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.student_id} className="border-b border-border last:border-0">
                    <td className="p-3 text-muted-foreground">{r.roll_number ?? "-"}</td>
                    <td className="p-3 font-medium">{r.first_name} {r.last_name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setMarks((m) => ({ ...m, [r.student_id]: s.value }))}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              marks[r.student_id] === s.value ? TONE_CLASS[s.tone] : "border-input bg-background text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {save.error instanceof ApiError && <p className="text-sm text-destructive">{save.error.message}</p>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save attendance"}
          </Button>
          {save.isSuccess && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
        </div>
      )}
    </div>
  );
}
