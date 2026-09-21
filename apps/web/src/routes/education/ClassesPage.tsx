import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KanbanSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { employeeName, type Employee } from "@/lib/people";

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}
interface SchoolClass {
  id: string;
  academic_year_id: string;
  name: string;
  sequence: number;
}
interface Section {
  id: string;
  school_class_id: string;
  name: string;
  capacity: number | null;
  class_teacher_id: string | null;
}

export function ClassesPage() {
  const queryClient = useQueryClient();
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const [yearId, setYearId] = useState<string | null>(null);
  const activeYearId = yearId ?? years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;

  const { data: classes, isLoading, error, refetch } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => apiFetch<Section[]>("/sections"),
    enabled: !!activeYearId,
  });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => apiFetch<Employee[]>("/employees") });
  const teacherById = new Map((employees ?? []).map((e) => [e.id, employeeName(e)]));

  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", sequence: "0" });
  const createClass = useMutation({
    mutationFn: () =>
      apiFetch<SchoolClass>("/school-classes", { method: "POST", body: { academic_year_id: activeYearId, name: classForm.name, sequence: Number(classForm.sequence) } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-classes", activeYearId] });
      setShowClassForm(false);
      setClassForm({ name: "", sequence: "0" });
    },
  });

  const [sectionFormFor, setSectionFormFor] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", capacity: "", class_teacher_id: "" });
  const createSection = useMutation({
    mutationFn: () =>
      apiFetch<Section>("/sections", {
        method: "POST",
        body: {
          school_class_id: sectionFormFor,
          name: sectionForm.name,
          capacity: sectionForm.capacity ? Number(sectionForm.capacity) : null,
          class_teacher_id: sectionForm.class_teacher_id || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setSectionFormFor(null);
      setSectionForm({ name: "", capacity: "", class_teacher_id: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Classes &amp; sections</h1>
          <p className="text-sm text-muted-foreground">Scoped to one academic year at a time.</p>
        </div>
        <div className="flex items-center gap-2">
          {years && years.length > 0 && (
            <select
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={activeYearId ?? ""}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
            </select>
          )}
          <Button onClick={() => setShowClassForm((v) => !v)} disabled={!activeYearId}>{showClassForm ? "Cancel" : "Add class"}</Button>
        </div>
      </div>

      {!years?.length && (
        <EmptyState icon={KanbanSquare} title="No academic year yet" description="Add an academic year first, then classes and sections." />
      )}

      {showClassForm && activeYearId && (
        <Card>
          <CardHeader><CardTitle className="text-base">New class</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={classForm.name} onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))} placeholder="Grade 5" />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={classForm.sequence} onChange={(e) => setClassForm((f) => ({ ...f, sequence: e.target.value }))} />
            </div>
            {createClass.isError && <ErrorState error={createClass.error} />}
            <div className="col-span-2">
              <Button onClick={() => createClass.mutate()} disabled={!classForm.name || createClass.isPending}>
                {createClass.isPending ? "Saving..." : "Save class"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {classes && classes.length === 0 && !showClassForm && (
        <EmptyState icon={KanbanSquare} title="No classes yet" description="Add your school's classes for this academic year." actionLabel="Add class" onAction={() => setShowClassForm(true)} />
      )}

      {classes && classes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...classes].sort((a, b) => a.sequence - b.sequence).map((c) => {
            const classSections = (sections ?? []).filter((s) => s.school_class_id === c.id);
            return (
              <Card key={c.id}>
                <CardHeader><CardTitle className="text-base">{c.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {classSections.length === 0 && <p className="text-sm text-muted-foreground">No sections yet.</p>}
                  {classSections.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>Section {s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.class_teacher_id ? teacherById.get(s.class_teacher_id) ?? "-" : "No class teacher"}
                        {s.capacity ? ` · ${s.capacity} seats` : ""}
                      </span>
                    </div>
                  ))}

                  {sectionFormFor === c.id ? (
                    <div className="space-y-2 border-t border-border pt-2">
                      <Input placeholder="Section name (A)" value={sectionForm.name} onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))} />
                      <Input placeholder="Capacity" type="number" value={sectionForm.capacity} onChange={(e) => setSectionForm((f) => ({ ...f, capacity: e.target.value }))} />
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={sectionForm.class_teacher_id}
                        onChange={(e) => setSectionForm((f) => ({ ...f, class_teacher_id: e.target.value }))}
                      >
                        <option value="">No class teacher</option>
                        {employees?.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
                      </select>
                      {createSection.isError && <ErrorState error={createSection.error} />}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => createSection.mutate()} disabled={!sectionForm.name || createSection.isPending}>
                          {createSection.isPending ? "Saving..." : "Save section"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSectionFormFor(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSectionFormFor(c.id)}>+ Add section</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
