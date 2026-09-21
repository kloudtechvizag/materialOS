import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  desired_grade: string | null;
  academic_year_id: string;
  status: string;
  application_date: string;
}
interface AcademicYear { id: string; name: string; is_current: boolean; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  submitted: "outline", under_review: "secondary", interview_scheduled: "secondary", interviewed: "secondary",
  offered: "secondary", waitlisted: "secondary", rejected: "destructive", withdrawn: "destructive", admitted: "success",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", under_review: "Under review", interview_scheduled: "Interview scheduled", interviewed: "Interviewed",
  offered: "Offered", waitlisted: "Waitlisted", rejected: "Rejected", withdrawn: "Withdrawn", admitted: "Admitted",
};

const EMPTY_FORM = { first_name: "", last_name: "", desired_grade: "", academic_year_id: "", guardian_name: "", guardian_phone: "" };

export function AdmissionApplicationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: applications, isLoading, error, refetch } = useQuery({
    queryKey: ["admission-applications", statusFilter],
    queryFn: () => apiFetch<Application[]>(`/admission-applications${statusFilter ? `?status=${statusFilter}` : ""}`),
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const yearById = new Map((years ?? []).map((y) => [y.id, y.name]));

  const createApplication = useMutation({
    mutationFn: () =>
      apiFetch<Application>("/admission-applications", { method: "POST", body: { ...form, guardian_phone: form.guardian_phone || null, desired_grade: form.desired_grade || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-applications"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admission applications</h1>
          <p className="text-sm text-muted-foreground">{applications?.length ?? 0} applications.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ New application"}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={statusFilter === null ? "default" : "outline"} onClick={() => setStatusFilter(null)}>All</Button>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <Button key={value} size="sm" variant={statusFilter === value ? "default" : "outline"} onClick={() => setStatusFilter(value)}>{label}</Button>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New application</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Desired grade</Label>
              <Input value={form.desired_grade} onChange={(e) => setForm((f) => ({ ...f, desired_grade: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Academic year applying to</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.academic_year_id} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: e.target.value }))}>
                <option value="">Select academic year...</option>
                {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Guardian name</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian phone</Label>
              <Input value={form.guardian_phone} onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} />
            </div>
            {createApplication.isError && <ErrorState error={createApplication.error} />}
            <div className="sm:col-span-2">
              <Button
                onClick={() => createApplication.mutate()}
                disabled={!form.first_name || !form.last_name || !form.academic_year_id || !form.guardian_name || createApplication.isPending}
              >
                {createApplication.isPending ? "Saving..." : "Save application"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {applications && applications.length === 0 && !showForm && (
        <EmptyState icon={ClipboardCheck} title="No applications yet" description="Applications appear here once logged directly or converted from an enquiry." />
      )}

      {applications && applications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Applicant</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Academic year</th>
                <th className="p-3">Applied</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3">
                    <Link to={`/admission-applications/${a.id}`} className="font-medium text-primary hover:underline">{a.first_name} {a.last_name}</Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{a.desired_grade ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{yearById.get(a.academic_year_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{a.application_date}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>{STATUS_LABEL[a.status] ?? a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
