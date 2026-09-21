import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  desired_grade: string | null;
  academic_year_id: string;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  application_date: string;
  status: string;
  interview_date: string | null;
  decision_reason: string | null;
  student_id: string | null;
}
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }

const TERMINAL = new Set(["admitted", "rejected", "withdrawn"]);
const PATCHABLE = ["under_review", "interview_scheduled", "interviewed", "offered", "waitlisted", "rejected", "withdrawn"];
const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", under_review: "Under review", interview_scheduled: "Interview scheduled", interviewed: "Interviewed",
  offered: "Offered", waitlisted: "Waitlisted", rejected: "Rejected", withdrawn: "Withdrawn", admitted: "Admitted",
};

export function AdmissionApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [interviewDate, setInterviewDate] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [convertForm, setConvertForm] = useState({ school_class_id: "", section_id: "", roll_number: "" });

  const { data: application, isLoading, error, refetch } = useQuery({
    queryKey: ["admission-application", applicationId],
    queryFn: () => apiFetch<Application>(`/admission-applications/${applicationId}`),
  });
  const { data: classes } = useQuery({
    queryKey: ["school-classes", application?.academic_year_id],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${application!.academic_year_id}`),
    enabled: !!application?.academic_year_id,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", convertForm.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${convertForm.school_class_id}`),
    enabled: !!convertForm.school_class_id,
  });

  const transition = useMutation({
    mutationFn: (status: string) =>
      apiFetch<Application>(`/admission-applications/${applicationId}`, {
        method: "PATCH",
        body: { status, interview_date: interviewDate || null, decision_reason: decisionReason || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-application", applicationId] });
      setInterviewDate("");
      setDecisionReason("");
    },
  });

  const convert = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/admission-applications/${applicationId}/convert`, {
        method: "POST",
        body: { ...convertForm, section_id: convertForm.section_id || null, roll_number: convertForm.roll_number || null },
      }),
    onSuccess: (student) => navigate(`/students/${student.id}`),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!application) return null;

  const isTerminal = TERMINAL.has(application.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{application.first_name} {application.last_name}</h1>
          <p className="text-sm text-muted-foreground">Applied {application.application_date}{application.desired_grade ? ` · ${application.desired_grade}` : ""}</p>
        </div>
        <Badge variant={application.status === "admitted" ? "success" : isTerminal ? "destructive" : "outline"}>{STATUS_LABEL[application.status]}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Guardian</span><span>{application.guardian_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{application.guardian_phone ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{application.guardian_email ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Interview date</span><span>{application.interview_date ?? "-"}</span></div>
            {application.decision_reason && <div className="flex justify-between"><span className="text-muted-foreground">Decision reason</span><span>{application.decision_reason}</span></div>}
          </CardContent>
        </Card>

        {!isTerminal && (
          <Card>
            <CardHeader><CardTitle className="text-base">Move stage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Interview date</Label>
                  <Input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Reason (for offer/waitlist/reject)</Label>
                  <Input value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                </div>
              </div>
              {transition.error instanceof ApiError && <p className="text-xs text-destructive">{transition.error.message}</p>}
              <div className="flex flex-wrap gap-2">
                {PATCHABLE.map((status) => (
                  <Button key={status} size="sm" variant="outline" onClick={() => transition.mutate(status)} disabled={transition.isPending}>
                    {STATUS_LABEL[status]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!isTerminal && (
        <Card>
          <CardHeader><CardTitle className="text-base">Convert to student</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Creates a real, enrolled Student record. This application will be marked admitted.</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Class</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={convertForm.school_class_id} onChange={(e) => setConvertForm((f) => ({ ...f, school_class_id: e.target.value, section_id: "" }))}>
                  <option value="">Select class...</option>
                  {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Section</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={convertForm.section_id} onChange={(e) => setConvertForm((f) => ({ ...f, section_id: e.target.value }))} disabled={!convertForm.school_class_id}>
                  <option value="">Unassigned</option>
                  {sections?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Roll number</Label>
                <Input value={convertForm.roll_number} onChange={(e) => setConvertForm((f) => ({ ...f, roll_number: e.target.value }))} />
              </div>
            </div>
            {convert.error instanceof ApiError && <p className="text-xs text-destructive">{convert.error.message}</p>}
            <Button onClick={() => convert.mutate()} disabled={!convertForm.school_class_id || convert.isPending}>
              {convert.isPending ? "Admitting..." : "Admit & create student"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
