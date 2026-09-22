import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Enquiry {
  id: string;
  branch_id: string;
  student_name: string;
  desired_grade: string | null;
  guardian_name: string;
  guardian_phone: string | null;
  source: string | null;
  status: string;
  follow_up_date: string | null;
}
interface AcademicYear { id: string; is_current: boolean; }
interface Branch { id: string; name: string; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  open: "outline", contacted: "secondary", converted: "success", closed: "destructive",
};

const EMPTY_FORM = { branch_id: "", student_name: "", desired_grade: "", guardian_name: "", guardian_phone: "", source: "", follow_up_date: "" };

export function AdmissionEnquiriesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: enquiries, isLoading, error, refetch } = useQuery({
    queryKey: ["admission-enquiries"],
    queryFn: () => apiFetch<Enquiry[]>("/admission-enquiries"),
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });

  const createEnquiry = useMutation({
    mutationFn: () =>
      apiFetch<Enquiry>("/admission-enquiries", {
        method: "POST",
        body: { ...form, guardian_phone: form.guardian_phone || null, source: form.source || null, follow_up_date: form.follow_up_date || null, desired_grade: form.desired_grade || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const convertToApplication = useMutation({
    mutationFn: async (enquiry: Enquiry) => {
      const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
      if (!currentYear) throw new Error("Add an academic year first.");
      const [first_name, ...rest] = enquiry.student_name.trim().split(" ");
      return apiFetch(`/admission-applications`, {
        method: "POST",
        body: {
          branch_id: enquiry.branch_id, enquiry_id: enquiry.id, first_name, last_name: rest.join(" ") || "-", desired_grade: enquiry.desired_grade,
          academic_year_id: currentYear.id, guardian_name: enquiry.guardian_name, guardian_phone: enquiry.guardian_phone,
        },
      });
    },
    onSuccess: (application: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      navigate(`/admission-applications/${(application as { id: string }).id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admission enquiries</h1>
          <p className="text-sm text-muted-foreground">The first, low-friction step -- convert to a formal application once it's real.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ Log enquiry"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New enquiry</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Campus</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.branch_id}
                onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              >
                <option value="">Select campus...</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Student name</Label>
              <Input value={form.student_name} onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Desired grade</Label>
              <Input value={form.desired_grade} onChange={(e) => setForm((f) => ({ ...f, desired_grade: e.target.value }))} placeholder="Grade 3" />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian name</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian phone</Label>
              <Input value={form.guardian_phone} onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="Website, Referral, Walk-in..." />
            </div>
            <div className="space-y-1.5">
              <Label>Follow-up date</Label>
              <Input type="date" value={form.follow_up_date} onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
            {createEnquiry.isError && <ErrorState error={createEnquiry.error} />}
            <div className="sm:col-span-2">
              <Button onClick={() => createEnquiry.mutate()} disabled={!form.branch_id || !form.student_name || !form.guardian_name || createEnquiry.isPending}>
                {createEnquiry.isPending ? "Saving..." : "Save enquiry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {enquiries && enquiries.length === 0 && !showForm && (
        <EmptyState icon={Inbox} title="No enquiries yet" description="Log a prospective family's enquiry to start tracking follow-up." actionLabel="Log enquiry" onAction={() => setShowForm(true)} />
      )}

      {enquiries && enquiries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Student</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Guardian</th>
                <th className="p-3">Status</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3">Quick actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3 font-medium">{e.student_name}</td>
                  <td className="p-3 text-muted-foreground">{e.desired_grade ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{e.guardian_name}{e.guardian_phone ? ` · ${e.guardian_phone}` : ""}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>{e.status}</Badge></td>
                  <td className="p-3 text-muted-foreground">{e.follow_up_date ?? "-"}</td>
                  <td className="p-3">
                    {e.status !== "converted" && e.status !== "closed" && (
                      <Button size="sm" variant="outline" onClick={() => convertToApplication.mutate(e)} disabled={convertToApplication.isPending}>
                        Convert to application
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {convertToApplication.isError && <ErrorState error={convertToApplication.error} />}
    </div>
  );
}
