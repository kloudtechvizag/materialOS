import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface ChildSummary { student_id: string; first_name: string; last_name: string; admission_number: string; school_class_name: string | null; section_name: string | null; }
interface AttendanceRecord { id: string; attendance_date: string; status: string; }
interface HomeworkEntry { homework: { id: string; title: string; due_date: string }; status: string; }
interface FeeInvoice { id: string; invoice_number: string; invoice_date: string; total: string; outstanding: string; }
interface TimetableEntry { day_of_week: number; slot_name: string; start_time: string; end_time: string; subject_name: string; room: string | null; }
interface Examination { id: string; name: string; is_locked: boolean; }
interface ReportCardSubject { subject_id: string; subject_name: string; max_marks: string; marks_obtained: string | null; is_absent: boolean; grade: string | null; }
interface ReportCard { subjects: ReportCardSubject[]; percentage: string | null; overall_grade: string | null; overall_result: string; }
interface Transport { route_name: string; vehicle_registration_number: string; driver_name: string; driver_phone: string | null; stop_name: string; pickup_time: string; drop_time: string; }

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function GuardianPortalChildPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const { data: children } = useQuery({ queryKey: ["guardian-portal-children"], queryFn: () => apiFetch<ChildSummary[]>("/guardian-portal/children") });
  const child = children?.find((c) => c.student_id === studentId);

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["guardian-portal-attendance", studentId],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/guardian-portal/children/${studentId}/attendance`),
  });
  const { data: homework } = useQuery({
    queryKey: ["guardian-portal-homework", studentId],
    queryFn: () => apiFetch<HomeworkEntry[]>(`/guardian-portal/children/${studentId}/homework`),
  });
  const { data: fees } = useQuery({
    queryKey: ["guardian-portal-fees", studentId],
    queryFn: () => apiFetch<FeeInvoice[]>(`/guardian-portal/children/${studentId}/fees`),
  });
  const { data: timetable } = useQuery({
    queryKey: ["guardian-portal-timetable", studentId],
    queryFn: () => apiFetch<TimetableEntry[]>(`/guardian-portal/children/${studentId}/timetable`),
  });
  const { data: examinations } = useQuery({
    queryKey: ["guardian-portal-examinations", studentId],
    queryFn: () => apiFetch<Examination[]>(`/guardian-portal/children/${studentId}/examinations`),
  });
  const { data: reportCard, isFetching: reportCardLoading } = useQuery({
    queryKey: ["guardian-portal-report-card", studentId, selectedExamId],
    queryFn: () => apiFetch<ReportCard>(`/guardian-portal/children/${studentId}/examinations/${selectedExamId}/report-card`),
    enabled: !!selectedExamId,
  });
  const { data: transport } = useQuery({
    queryKey: ["guardian-portal-transport", studentId],
    queryFn: () => apiFetch<Transport | null>(`/guardian-portal/children/${studentId}/transport`),
  });

  if (attendanceLoading) return <Skeleton className="h-96" />;

  const timetableByDay = DAYS.map((label, idx) => ({ label, entries: (timetable ?? []).filter((t) => t.day_of_week === idx) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{child ? `${child.first_name} ${child.last_name}` : "..."}</h1>
        <p className="text-sm text-muted-foreground">
          {child?.admission_number} · {child?.school_class_name ?? "Not enrolled"}{child?.section_name ? ` - ${child.section_name}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(!attendance || attendance.length === 0) && <p className="text-muted-foreground">No attendance recorded yet.</p>}
            {attendance && attendance.length > 0 && (
              <>
                <p className="text-muted-foreground">
                  {Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)}% present over {attendance.length} recorded day{attendance.length === 1 ? "" : "s"}.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {attendance.slice(0, 20).map((a) => (
                    <span
                      key={a.id}
                      title={`${a.attendance_date}: ${a.status}`}
                      className={"h-2.5 w-2.5 rounded-full " + (a.status === "present" ? "bg-emerald-500" : a.status === "absent" ? "bg-destructive" : "bg-amber-500")}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Homework</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(!homework || homework.length === 0) && <p className="text-muted-foreground">No homework assigned yet.</p>}
            {homework?.map((entry) => (
              <div key={entry.homework.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                <div>
                  <p className="font-medium">{entry.homework.title}</p>
                  <p className="text-xs text-muted-foreground">Due {entry.homework.due_date}</p>
                </div>
                <Badge variant={entry.status === "submitted" ? "success" : entry.status === "late" ? "warning" : entry.status === "missing" ? "destructive" : "outline"}>
                  {entry.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Fees</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(!fees || fees.length === 0) && <p className="text-muted-foreground">No fee invoices yet.</p>}
            {fees?.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_date} · Total ₹{inv.total}</p>
                </div>
                <Badge variant={Number(inv.outstanding) <= 0 ? "success" : "outline"}>
                  {Number(inv.outstanding) <= 0 ? "Paid" : `₹${inv.outstanding} due`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Timetable</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(!timetable || timetable.length === 0) && <p className="text-muted-foreground">No timetable published yet.</p>}
            {timetableByDay.filter((d) => d.entries.length > 0).map((d) => (
              <div key={d.label}>
                <p className="text-xs font-medium uppercase text-muted-foreground">{d.label}</p>
                {d.entries.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span>{e.slot_name} — {e.subject_name}</span>
                    <span className="text-xs text-muted-foreground">{e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Transport</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!transport && <p className="text-muted-foreground">Not assigned to a route yet.</p>}
            {transport && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Route</span><span>{transport.route_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stop</span><span>{transport.stop_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pickup / Drop</span><span>{transport.pickup_time.slice(0, 5)} / {transport.drop_time.slice(0, 5)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span>{transport.vehicle_registration_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Driver</span><span>{transport.driver_name}{transport.driver_phone ? ` · ${transport.driver_phone}` : ""}</span></div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
