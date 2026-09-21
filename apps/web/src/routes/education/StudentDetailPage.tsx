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
interface AttendanceRecord { id: string; attendance_date: string; status: string; }
interface Examination { id: string; academic_year_id: string; name: string; is_locked: boolean; }
interface ReportCardSubject { subject_id: string; subject_name: string; max_marks: string; pass_marks: string; marks_obtained: string | null; is_absent: boolean; is_pass: boolean | null; grade: string | null; }
interface ReportCard { subjects: ReportCardSubject[]; total_marks_obtained: string; total_max_marks: string; percentage: string | null; overall_grade: string | null; overall_result: string; }
interface StudentHomeworkEntry { homework: { id: string; title: string; due_date: string }; status: string; }
interface FeeInvoiceSummary { id: string; invoice_id: string; invoice_number: string; invoice_date: string; customer_id: string; total: string; outstanding: string; }

const STATUS_LABELS: Record<string, string> = { active: "Active", transferred: "Transferred", withdrawn: "Withdrawn", alumni: "Alumni", inactive: "Inactive" };

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const queryClient = useQueryClient();
  const [guardianForm, setGuardianForm] = useState({ full_name: "", phone: "", relationship_type: "guardian" });
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

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
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance-history", studentId],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/student-attendance?student_id=${studentId}`),
  });
  const { data: examinations } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const { data: reportCard, isFetching: reportCardLoading } = useQuery({
    queryKey: ["report-card", selectedExamId, studentId],
    queryFn: () => apiFetch<ReportCard>(`/examinations/${selectedExamId}/report-card/${studentId}`),
    enabled: !!selectedExamId,
  });
  const { data: homeworkEntries } = useQuery({
    queryKey: ["student-homework", studentId],
    queryFn: () => apiFetch<StudentHomeworkEntry[]>(`/students/${studentId}/homework`),
  });
  const { data: feeInvoices } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: () => apiFetch<FeeInvoiceSummary[]>(`/students/${studentId}/fees`),
  });

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

  const recordPayment = useMutation({
    mutationFn: (invoice: FeeInvoiceSummary) =>
      apiFetch("/receipts", {
        method: "POST",
        body: { customer_id: invoice.customer_id, amount: paymentAmount, mode: "cash", reference_note: `Fee payment for ${invoice.invoice_number}`, invoice_id: invoice.invoice_id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees", studentId] });
      setPayingInvoiceId(null);
      setPaymentAmount("");
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

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(!attendance || attendance.length === 0) && <p className="text-muted-foreground">No attendance recorded yet.</p>}
          {attendance && attendance.length > 0 && (
            <>
              <p className="text-muted-foreground">
                {Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)}% present
                over {attendance.length} recorded day{attendance.length === 1 ? "" : "s"}.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attendance.slice(0, 20).map((a) => (
                  <span
                    key={a.id}
                    title={`${a.attendance_date}: ${a.status}`}
                    className={
                      "h-2.5 w-2.5 rounded-full " +
                      (a.status === "present" ? "bg-emerald-500" : a.status === "absent" ? "bg-destructive" : "bg-amber-500")
                    }
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Report cards</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(!examinations || examinations.length === 0) && <p className="text-muted-foreground">No examinations yet.</p>}
          <div className="flex flex-wrap gap-1.5">
            {examinations?.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => setSelectedExamId(exam.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selectedExamId === exam.id ? "border-primary bg-accent" : "border-input text-muted-foreground hover:bg-accent"}`}
              >
                {exam.name}
              </button>
            ))}
          </div>

          {selectedExamId && reportCardLoading && <p className="text-muted-foreground">Loading...</p>}
          {selectedExamId && reportCard && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Badge variant={reportCard.overall_result === "pass" ? "success" : reportCard.overall_result === "fail" ? "destructive" : "outline"}>
                  {reportCard.overall_result === "incomplete" ? "Incomplete" : reportCard.overall_result === "pass" ? "Pass" : "Fail"}
                </Badge>
                {reportCard.percentage !== null && (
                  <span className="text-muted-foreground">{reportCard.percentage}% {reportCard.overall_grade ? `· Grade ${reportCard.overall_grade}` : ""}</span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1">Subject</th>
                    <th className="py-1">Marks</th>
                    <th className="py-1">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCard.subjects.map((s) => (
                    <tr key={s.subject_id} className="border-b border-border last:border-0">
                      <td className="py-1">{s.subject_name}</td>
                      <td className="py-1">{s.is_absent ? "Absent" : s.marks_obtained !== null ? `${s.marks_obtained} / ${s.max_marks}` : "Not marked"}</td>
                      <td className="py-1">{s.grade ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fees</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(!feeInvoices || feeInvoices.length === 0) && <p className="text-muted-foreground">No fee invoices yet.</p>}
          {feeInvoices?.map((inv) => (
            <div key={inv.id} className="space-y-1.5 border-b border-border py-1.5 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_date} · Total ₹{inv.total}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={Number(inv.outstanding) <= 0 ? "success" : "outline"}>
                    {Number(inv.outstanding) <= 0 ? "Paid" : `₹${inv.outstanding} due`}
                  </Badge>
                  {Number(inv.outstanding) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => { setPayingInvoiceId(inv.id); setPaymentAmount(inv.outstanding); }}>
                      Record payment
                    </Button>
                  )}
                </div>
              </div>
              {payingInvoiceId === inv.id && (
                <div className="flex items-center gap-2">
                  <Input type="number" className="h-8 w-28" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <Button size="sm" className="h-8" onClick={() => recordPayment.mutate(inv)} disabled={!paymentAmount || recordPayment.isPending}>
                    {recordPayment.isPending ? "Saving..." : "Confirm"}
                  </Button>
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPayingInvoiceId(null)}>Cancel</button>
                </div>
              )}
              {recordPayment.error instanceof ApiError && payingInvoiceId === inv.id && <p className="text-xs text-destructive">{recordPayment.error.message}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Homework</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(!homeworkEntries || homeworkEntries.length === 0) && <p className="text-muted-foreground">No homework assigned yet.</p>}
          {homeworkEntries?.map((entry) => (
            <div key={entry.homework.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <div>
                <p className="font-medium">{entry.homework.title}</p>
                <p className="text-xs text-muted-foreground">Due {entry.homework.due_date}</p>
              </div>
              <Badge
                variant={entry.status === "submitted" ? "success" : entry.status === "late" ? "warning" : entry.status === "missing" ? "destructive" : "outline"}
              >
                {entry.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
