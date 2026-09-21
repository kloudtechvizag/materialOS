import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  email: string | null;
  previous_school: string | null;
  admission_date: string;
  category: string | null;
  status: string;
}
interface AcademicYear { id: string; name: string; is_current: boolean; }
interface SchoolClass { id: string; name: string; academic_year_id: string; }
interface Section { id: string; name: string; school_class_id: string; }
interface StudentEnrolment { id: string; academic_year_id: string; school_class_id: string; section_id: string | null; roll_number: string | null; status: string; enrolment_date: string; }
interface Guardian { id: string; full_name: string; phone: string | null; email: string | null; }
interface StudentGuardianLink { id: string; guardian_id: string; relationship_type: string; is_primary_contact: boolean; }

const STATUS_LABELS: Record<string, string> = { active: "Active", transferred: "Transferred", withdrawn: "Withdrawn", alumni: "Alumni", inactive: "Inactive" };

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const queryClient = useQueryClient();
  const [guardianForm, setGuardianForm] = useState({ full_name: "", phone: "", relationship_type: "guardian" });

  const { data: student, isLoading, error, refetch } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => apiFetch<Student>(`/students/${studentId}`),
  });
  const { data: enrolments } = useQuery({
    queryKey: ["student-enrolments", studentId],
    queryFn: () => apiFetch<StudentEnrolment[]>(`/students/${studentId}/enrolments`),
  });
  const { data: links } = useQuery({
    queryKey: ["student-guardians", studentId],
    queryFn: () => apiFetch<StudentGuardianLink[]>(`/students/${studentId}/guardians`),
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: classes } = useQuery({ queryKey: ["all-school-classes"], queryFn: async () => (await Promise.all((await apiFetch<AcademicYear[]>("/academic-years")).map((y) => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${y.id}`)))).flat() });
  const { data: sections } = useQuery({ queryKey: ["all-sections"], queryFn: () => apiFetch<Section[]>("/sections") });
  const { data: guardians } = useQuery({ queryKey: ["guardians"], queryFn: () => apiFetch<Guardian[]>("/guardians") });

  const yearById = new Map((years ?? []).map((y) => [y.id, y.name]));
  const classById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const sectionById = new Map((sections ?? []).map((s) => [s.id, s.name]));
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiFetch<Student>(`/students/${studentId}`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["student", studentId] }),
  });

  const addGuardian = useMutation({
    mutationFn: async () => {
      const guardian = await apiFetch<Guardian>("/guardians", { method: "POST", body: { full_name: guardianForm.full_name, phone: guardianForm.phone || null } });
      return apiFetch(`/students/${studentId}/guardians`, { method: "POST", body: { guardian_id: guardian.id, relationship_type: guardianForm.relationship_type, is_primary_contact: (links?.length ?? 0) === 0 } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      setGuardianForm({ full_name: "", phone: "", relationship_type: "guardian" });
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!student) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{student.first_name} {student.last_name}</h1>
          <p className="text-sm text-muted-foreground">{student.admission_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{STATUS_LABELS[student.status] ?? student.status}</Badge>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && updateStatus.mutate(e.target.value)}
          >
            <option value="">Change status...</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Admitted</span><span>{student.admission_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date of birth</span><span>{student.date_of_birth ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span>{student.gender ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Blood group</span><span>{student.blood_group ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{student.phone ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{student.email ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Previous school</span><span>{student.previous_school ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{student.category ?? "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Enrolment history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(!enrolments || enrolments.length === 0) && <p className="text-muted-foreground">Not enrolled in any academic year yet.</p>}
            {enrolments?.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                <div>
                  <p className="font-medium">{yearById.get(e.academic_year_id) ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">
                    {classById.get(e.school_class_id) ?? "-"}{e.section_id ? ` - ${sectionById.get(e.section_id) ?? "-"}` : ""}
                    {e.roll_number ? ` · Roll ${e.roll_number}` : ""}
                  </p>
                </div>
                <Badge variant="outline">{e.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Guardians</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(!links || links.length === 0) && <p className="text-sm text-muted-foreground">No guardians linked yet.</p>}
          <div className="space-y-2">
            {links?.map((l) => {
              const g = guardianById.get(l.guardian_id);
              return (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span>{g?.full_name ?? "-"} <span className="text-muted-foreground">({l.relationship_type})</span></span>
                  <span className="text-xs text-muted-foreground">{g?.phone ?? "-"}{l.is_primary_contact && " · Primary"}</span>
                </div>
              );
            })}
          </div>
          <details className="pt-1">
            <summary className="cursor-pointer text-xs text-primary">Add guardian</summary>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Input placeholder="Full name" value={guardianForm.full_name} onChange={(e) => setGuardianForm((f) => ({ ...f, full_name: e.target.value }))} />
              <Input placeholder="Phone" value={guardianForm.phone} onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))} />
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={guardianForm.relationship_type}
                onChange={(e) => setGuardianForm((f) => ({ ...f, relationship_type: e.target.value }))}
              >
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </select>
              {addGuardian.error instanceof ApiError && <p className="col-span-3 text-xs text-destructive">{addGuardian.error.message}</p>}
              <Button size="sm" className="col-span-3" onClick={() => addGuardian.mutate()} disabled={!guardianForm.full_name || addGuardian.isPending}>
                {addGuardian.isPending ? "Saving..." : "Save guardian"}
              </Button>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
