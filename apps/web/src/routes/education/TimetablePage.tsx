import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AcademicYear { id: string; name: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Subject { id: string; name: string; code: string; is_active: boolean; }
interface Slot { id: string; name: string; sequence: number; start_time: string; end_time: string; is_break: boolean; }
interface Entry { id: string; section_id: string; day_of_week: number; slot_id: string; subject_id: string; teacher_id: string | null; room: string | null; }
interface Employee { id: string; employee_code: string; first_name: string; last_name: string; }

// Indian schools are conventionally Monday-Saturday -- Sunday is
// deliberately not shown as a schedulable day in this default grid
// (day_of_week itself still accepts 0-6 server-side).
const DAYS = [
  { value: 0, label: "Mon" }, { value: 1, label: "Tue" }, { value: 2, label: "Wed" },
  { value: 3, label: "Thu" }, { value: 4, label: "Fri" }, { value: 5, label: "Sat" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function cellKey(day: number, slotId: string) {
  return `${day}:${slotId}`;
}

/** Weekly class/section timetable (spec sec10): a shared period grid,
 * subject + teacher per (section, day, slot) cell, with a real
 * teacher double-booking conflict check enforced server-side. */
export function TimetablePage() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ day: number; slotId: string } | null>(null);
  const [cellForm, setCellForm] = useState<{ subject_id: string; teacher_id: string; room: string }>({ subject_id: "", teacher_id: "", room: "" });
  const [showSetup, setShowSetup] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [slotForm, setSlotForm] = useState({ name: "", sequence: "1", start_time: "09:00", end_time: "09:45", is_break: false });

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

  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: () => apiFetch<Subject[]>("/subjects") });
  const { data: slots } = useQuery({ queryKey: ["timetable-slots"], queryFn: () => apiFetch<Slot[]>("/timetable-slots") });
  const { data: employees } = useQuery({ queryKey: ["employees-for-timetable"], queryFn: () => apiFetch<Employee[]>("/employees") });

  const { data: entries, isLoading, error, refetch } = useQuery({
    queryKey: ["timetable", activeSectionId],
    queryFn: () => apiFetch<Entry[]>(`/timetable?section_id=${activeSectionId}`),
    enabled: !!activeSectionId,
  });

  const entryByCell = new Map((entries ?? []).map((e) => [cellKey(e.day_of_week, e.slot_id), e]));
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s]));
  const teacherById = new Map((employees ?? []).map((e) => [e.id, e]));

  const saveCell = useMutation({
    mutationFn: () =>
      apiFetch("/timetable/entries", {
        method: "PUT",
        body: {
          section_id: activeSectionId, day_of_week: editing!.day, slot_id: editing!.slotId,
          subject_id: cellForm.subject_id, teacher_id: cellForm.teacher_id || null, room: cellForm.room || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable", activeSectionId] });
      setEditing(null);
    },
  });

  const clearCell = useMutation({
    mutationFn: (entryId: string) => apiFetch(`/timetable/entries/${entryId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable", activeSectionId] });
      setEditing(null);
    },
  });

  const addSubject = useMutation({
    mutationFn: () => apiFetch("/subjects", { method: "POST", body: subjectForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setSubjectForm({ name: "", code: "" });
    },
  });

  const addSlot = useMutation({
    mutationFn: () =>
      apiFetch("/timetable-slots", {
        method: "POST",
        body: {
          name: slotForm.name, sequence: Number(slotForm.sequence),
          start_time: `${slotForm.start_time}:00`, end_time: `${slotForm.end_time}:00`, is_break: slotForm.is_break,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable-slots"] });
      setSlotForm({ name: "", sequence: String((slots?.length ?? 0) + 1), start_time: "09:00", end_time: "09:45", is_break: false });
    },
  });

  function openCell(day: number, slot: Slot) {
    if (slot.is_break) return;
    const existing = entryByCell.get(cellKey(day, slot.id));
    setCellForm({ subject_id: existing?.subject_id ?? "", teacher_id: existing?.teacher_id ?? "", room: existing?.room ?? "" });
    setEditing({ day, slotId: slot.id });
  }

  const sortedSlots = [...(slots ?? [])].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Timetable</h1>
          <p className="text-sm text-muted-foreground">Weekly period schedule, per class section.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSetup((v) => !v)}>
          {showSetup ? "Hide setup" : "Manage subjects & periods"}
        </Button>
      </div>

      {showSetup && (
        <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Subjects</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {subjects?.map((s) => <li key={s.id}>{s.name} <span className="text-xs">({s.code})</span></li>)}
              {subjects?.length === 0 && <li>No subjects yet.</li>}
            </ul>
            <div className="flex gap-2">
              <Input placeholder="Name" value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Code" value={subjectForm.code} onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))} className="w-24" />
              <Button size="sm" onClick={() => addSubject.mutate()} disabled={!subjectForm.name || !subjectForm.code || addSubject.isPending}>Add</Button>
            </div>
            {addSubject.error instanceof ApiError && <p className="text-xs text-destructive">{addSubject.error.message}</p>}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Periods</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {sortedSlots.map((s) => <li key={s.id}>{s.sequence}. {s.name} — {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.is_break ? " (break)" : ""}</li>)}
              {sortedSlots.length === 0 && <li>No periods yet.</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Name" value={slotForm.name} onChange={(e) => setSlotForm((f) => ({ ...f, name: e.target.value }))} className="w-28" />
              <Input type="number" placeholder="#" value={slotForm.sequence} onChange={(e) => setSlotForm((f) => ({ ...f, sequence: e.target.value }))} className="w-16" />
              <input type="time" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={slotForm.start_time} onChange={(e) => setSlotForm((f) => ({ ...f, start_time: e.target.value }))} />
              <input type="time" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={slotForm.end_time} onChange={(e) => setSlotForm((f) => ({ ...f, end_time: e.target.value }))} />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={slotForm.is_break} onChange={(e) => setSlotForm((f) => ({ ...f, is_break: e.target.checked }))} /> Break
              </label>
              <Button size="sm" onClick={() => addSlot.mutate()} disabled={!slotForm.name || addSlot.isPending}>Add</Button>
            </div>
            {addSlot.error instanceof ApiError && <p className="text-xs text-destructive">{addSlot.error.message}</p>}
          </div>
        </div>
      )}

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
      </div>

      {!activeSectionId && <p className="text-sm text-muted-foreground">Add a class and section first.</p>}
      {activeSectionId && sortedSlots.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>No periods configured yet -- use "Manage subjects & periods" to set up the daily grid.</span>
        </div>
      )}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {activeSectionId && sortedSlots.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Period</th>
                {DAYS.map((d) => <th key={d.value} className="p-3">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {sortedSlots.map((slot) => (
                <tr key={slot.id} className="border-b border-border last:border-0">
                  <td className="p-3 align-top text-muted-foreground">
                    <div className="font-medium text-foreground">{slot.name}</div>
                    <div className="text-xs">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</div>
                  </td>
                  {DAYS.map((d) => {
                    if (slot.is_break) {
                      return <td key={d.value} className="bg-muted/30 p-3 text-center text-xs text-muted-foreground">Break</td>;
                    }
                    const entry = entryByCell.get(cellKey(d.value, slot.id));
                    const isEditing = editing?.day === d.value && editing?.slotId === slot.id;
                    return (
                      <td key={d.value} className="p-2 align-top">
                        {isEditing ? (
                          <div className="space-y-1.5 rounded-md border border-primary bg-background p-2">
                            <select className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs" value={cellForm.subject_id} onChange={(e) => setCellForm((f) => ({ ...f, subject_id: e.target.value }))}>
                              <option value="">Subject...</option>
                              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs" value={cellForm.teacher_id} onChange={(e) => setCellForm((f) => ({ ...f, teacher_id: e.target.value }))}>
                              <option value="">Teacher...</option>
                              {employees?.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                            </select>
                            <Input placeholder="Room" value={cellForm.room} onChange={(e) => setCellForm((f) => ({ ...f, room: e.target.value }))} className="h-8 text-xs" />
                            {saveCell.error instanceof ApiError && <p className="text-xs text-destructive">{saveCell.error.message}</p>}
                            <div className="flex items-center justify-between gap-1 pt-0.5">
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7 px-2 text-xs" disabled={!cellForm.subject_id || saveCell.isPending} onClick={() => saveCell.mutate()}>Save</Button>
                                {entry && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={clearCell.isPending} onClick={() => clearCell.mutate(entry.id)}>Clear</Button>}
                              </div>
                              <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCell(d.value, slot)}
                            className={cn(
                              "w-full rounded-md border border-dashed border-transparent p-2 text-left text-xs hover:border-input hover:bg-accent",
                              entry && "border-solid border-border bg-muted/40"
                            )}
                          >
                            {entry ? (
                              <>
                                <div className="font-medium">{subjectById.get(entry.subject_id)?.name ?? "-"}</div>
                                {entry.teacher_id && <div className="text-muted-foreground">{teacherById.get(entry.teacher_id)?.first_name} {teacherById.get(entry.teacher_id)?.last_name}</div>}
                                {entry.room && <div className="text-muted-foreground">Room {entry.room}</div>}
                              </>
                            ) : (
                              <span className="text-muted-foreground">+ Add</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
