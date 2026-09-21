import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FilePenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface AcademicYear { id: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Subject { id: string; name: string; }
interface Homework { id: string; section_id: string; subject_id: string; title: string; assigned_date: string; due_date: string; }

/** Homework & Assignments (spec sec15): assign homework to a real
 * section+subject; submission status is tracked staff-side (no
 * student/parent portal exists yet) on the detail page's roster. */
export function HomeworkPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [form, setForm] = useState({ section_id: "", subject_id: "", title: "", description: "", assigned_date: "", due_date: "" });

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
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: () => apiFetch<Subject[]>("/subjects") });
  const { data: homeworkList, isLoading } = useQuery({ queryKey: ["homework"], queryFn: () => apiFetch<Homework[]>("/homework") });
  const { data: allSections } = useQuery({ queryKey: ["all-sections"], queryFn: () => apiFetch<Section[]>("/sections") });
  const { data: allClasses } = useQuery({
    queryKey: ["all-school-classes"],
    queryFn: async () => (await Promise.all((await apiFetch<AcademicYear[]>("/academic-years")).map((y) => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${y.id}`)))).flat(),
  });

  const sectionById = new Map((allSections ?? []).map((s) => [s.id, s]));
  const classById = new Map((allClasses ?? []).map((c) => [c.id, c.name]));
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const create = useMutation({
    mutationFn: () => apiFetch("/homework", { method: "POST", body: { ...form, description: form.description || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      setShowCreate(false);
      setForm({ section_id: "", subject_id: "", title: "", description: "", assigned_date: "", due_date: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Homework</h1>
          <p className="text-sm text-muted-foreground">Assign homework per class section, then track submissions.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "New homework"}</Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeYearId ?? ""} onChange={(e) => { setAcademicYearId(e.target.value); setClassId(null); setForm((f) => ({ ...f, section_id: "" })); }}>
              {years?.map((y) => <option key={y.id} value={y.id}>{y.is_current ? "Current year" : y.id}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeClassId ?? ""} onChange={(e) => { setClassId(e.target.value); setForm((f) => ({ ...f, section_id: "" })); }}>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.section_id} onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value }))}>
              <option value="">Section...</option>
              {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}>
              <option value="">Subject...</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <Input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Assigned date
              <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.assigned_date} onChange={(e) => setForm((f) => ({ ...f, assigned_date: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Due date
              <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </label>
          </div>
          {create.error instanceof ApiError && <p className="text-sm text-destructive">{create.error.message}</p>}
          <Button size="sm" onClick={() => create.mutate()} disabled={!form.section_id || !form.subject_id || !form.title || !form.assigned_date || !form.due_date || create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {homeworkList && homeworkList.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <FilePenLine className="h-4 w-4" />
          <span>No homework assigned yet.</span>
        </div>
      )}
      {homeworkList && homeworkList.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Title</th>
                <th className="p-3">Section</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {homeworkList.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3 font-medium"><Link to={`/homework/${h.id}`} className="hover:underline">{h.title}</Link></td>
                  <td className="p-3 text-muted-foreground">{classById.get(sectionById.get(h.section_id)?.school_class_id ?? "") ?? "-"} {sectionById.get(h.section_id) ? `- ${sectionById.get(h.section_id)!.name}` : ""}</td>
                  <td className="p-3 text-muted-foreground">{subjectById.get(h.subject_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{h.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
