import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface Examination { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_locked: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Subject { id: string; name: string; code: string; }
interface Schedule { id: string; school_class_id: string; subject_id: string; max_marks: string; pass_marks: string; }
interface RosterEntry { student_id: string; first_name: string; last_name: string; roll_number: string | null; marks_obtained: string | null; is_absent: boolean; remarks: string | null; }

export function ExaminationDetailPage() {
  const { examinationId } = useParams<{ examinationId: string }>();
  const queryClient = useQueryClient();
  const [scheduleForm, setScheduleForm] = useState({ school_class_id: "", subject_id: "", max_marks: "100", pass_marks: "33" });
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, { marks_obtained: string; is_absent: boolean }>>({});

  const { data: exam, refetch: refetchExam } = useQuery({
    queryKey: ["examination", examinationId],
    queryFn: () => apiFetch<Examination[]>("/examinations").then((all) => all.find((e) => e.id === examinationId)!),
  });
  const { data: classes } = useQuery({ queryKey: ["school-classes", exam?.academic_year_id], queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${exam!.academic_year_id}`), enabled: !!exam });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: () => apiFetch<Subject[]>("/subjects") });
  const classById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s]));

  const { data: schedules } = useQuery({
    queryKey: ["exam-subjects", examinationId],
    queryFn: () => apiFetch<Schedule[]>(`/examinations/${examinationId}/subjects`),
    enabled: !!examinationId,
  });

  const activeSchedule = schedules?.find((s) => s.id === activeScheduleId) ?? null;
  const { data: sections } = useQuery({
    queryKey: ["sections", activeSchedule?.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${activeSchedule!.school_class_id}`),
    enabled: !!activeSchedule,
  });
  const effectiveSectionId = activeSectionId ?? sections?.[0]?.id ?? null;

  const { data: roster, refetch: refetchRoster } = useQuery({
    queryKey: ["exam-roster", activeScheduleId, effectiveSectionId],
    queryFn: async () => {
      const rows = await apiFetch<RosterEntry[]>(`/examinations/subjects/${activeScheduleId}/roster?section_id=${effectiveSectionId}`);
      setMarks(Object.fromEntries(rows.map((r) => [r.student_id, { marks_obtained: r.marks_obtained ?? "", is_absent: r.is_absent }])));
      return rows;
    },
    enabled: !!activeScheduleId && !!effectiveSectionId,
  });

  const addSchedule = useMutation({
    mutationFn: () => apiFetch(`/examinations/${examinationId}/subjects`, { method: "POST", body: scheduleForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-subjects", examinationId] });
      setScheduleForm({ school_class_id: "", subject_id: "", max_marks: "100", pass_marks: "33" });
    },
  });

  const toggleLock = useMutation({
    mutationFn: () => apiFetch(`/examinations/${examinationId}/${exam!.is_locked ? "unlock" : "lock"}`, { method: "POST" }),
    onSuccess: () => refetchExam(),
  });

  const saveMarks = useMutation({
    mutationFn: () =>
      apiFetch(`/examinations/subjects/${activeScheduleId}/marks/bulk`, {
        method: "POST",
        body: {
          records: Object.entries(marks).map(([student_id, m]) => ({
            student_id, is_absent: m.is_absent, marks_obtained: m.is_absent || m.marks_obtained === "" ? null : m.marks_obtained,
          })),
        },
      }),
    onSuccess: () => refetchRoster(),
  });

  if (!exam) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{exam.name}</h1>
          <p className="text-sm text-muted-foreground">{exam.start_date} – {exam.end_date}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={exam.is_locked ? "outline" : "secondary"}>{exam.is_locked ? "Locked" : "Open"}</Badge>
          <Button size="sm" variant="outline" onClick={() => toggleLock.mutate()} disabled={toggleLock.isPending}>
            {exam.is_locked ? "Unlock" : "Lock"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Subjects scheduled</h2>
        <div className="space-y-1">
          {schedules?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActiveScheduleId(s.id); setActiveSectionId(null); }}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${activeScheduleId === s.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
            >
              <span>{classById.get(s.school_class_id) ?? "-"} — {subjectById.get(s.subject_id)?.name ?? "-"}</span>
              <span className="text-xs text-muted-foreground">Max {s.max_marks} / Pass {s.pass_marks}</span>
            </button>
          ))}
          {schedules?.length === 0 && <p className="text-sm text-muted-foreground">No subjects scheduled yet.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={scheduleForm.school_class_id} onChange={(e) => setScheduleForm((f) => ({ ...f, school_class_id: e.target.value }))}>
            <option value="">Class...</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={scheduleForm.subject_id} onChange={(e) => setScheduleForm((f) => ({ ...f, subject_id: e.target.value }))}>
            <option value="">Subject...</option>
            {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Input type="number" placeholder="Max marks" value={scheduleForm.max_marks} onChange={(e) => setScheduleForm((f) => ({ ...f, max_marks: e.target.value }))} className="w-28" />
          <Input type="number" placeholder="Pass marks" value={scheduleForm.pass_marks} onChange={(e) => setScheduleForm((f) => ({ ...f, pass_marks: e.target.value }))} className="w-28" />
          <Button size="sm" onClick={() => addSchedule.mutate()} disabled={!scheduleForm.school_class_id || !scheduleForm.subject_id || addSchedule.isPending}>Add</Button>
        </div>
        {addSchedule.error instanceof ApiError && <p className="text-sm text-destructive">{addSchedule.error.message}</p>}
      </div>

      {activeSchedule && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Marks entry — {classById.get(activeSchedule.school_class_id)} · {subjectById.get(activeSchedule.subject_id)?.name}
            </h2>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={effectiveSectionId ?? ""} onChange={(e) => setActiveSectionId(e.target.value)}>
              {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
          </div>

          {roster && roster.length === 0 && <p className="text-sm text-muted-foreground">No students enrolled in this section.</p>}
          {roster && roster.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <th className="p-3">Roll</th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Marks</th>
                      <th className="p-3">Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.student_id} className="border-b border-border last:border-0">
                        <td className="p-3 text-muted-foreground">{r.roll_number ?? "-"}</td>
                        <td className="p-3 font-medium">{r.first_name} {r.last_name}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            className="h-8 w-24"
                            disabled={exam.is_locked || marks[r.student_id]?.is_absent}
                            value={marks[r.student_id]?.marks_obtained ?? ""}
                            onChange={(e) => setMarks((m) => ({ ...m, [r.student_id]: { ...m[r.student_id], marks_obtained: e.target.value } }))}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            disabled={exam.is_locked}
                            checked={marks[r.student_id]?.is_absent ?? false}
                            onChange={(e) => setMarks((m) => ({ ...m, [r.student_id]: { ...m[r.student_id], is_absent: e.target.checked } }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {saveMarks.error instanceof ApiError && <p className="text-sm text-destructive">{saveMarks.error.message}</p>}
              <Button onClick={() => saveMarks.mutate()} disabled={exam.is_locked || saveMarks.isPending}>
                {saveMarks.isPending ? "Saving..." : "Save marks"}
              </Button>
              {saveMarks.isSuccess && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
              {exam.is_locked && <p className="text-sm text-muted-foreground">This examination is locked -- unlock it to edit marks.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
