import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock } from "lucide-react";
import type {
  AttendanceRecord, FeeInvoiceSummary, Guardian, Student, StudentEnrolment, StudentGuardianLink, StudentHomeworkEntry,
} from "./types";
import { buildTimelineEvents } from "./timelineEvents";

export function OverviewTab({
  student, enrolments, attendance, feeInvoices, homeworkEntries, guardianLinks, guardianById,
}: {
  student: Student;
  enrolments: StudentEnrolment[] | undefined;
  attendance: AttendanceRecord[] | undefined;
  feeInvoices: FeeInvoiceSummary[] | undefined;
  homeworkEntries: StudentHomeworkEntry[] | undefined;
  guardianLinks: StudentGuardianLink[] | undefined;
  guardianById: Map<string, Guardian>;
}) {
  const attendancePct = attendance && attendance.length > 0 ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100) : null;
  const totalOutstanding = (feeInvoices ?? []).reduce((sum, inv) => sum + Number(inv.outstanding), 0);
  const pendingHomework = (homeworkEntries ?? []).filter((e) => e.status === "pending");
  const upcomingHomework = [...pendingHomework].sort((a, b) => a.homework.due_date.localeCompare(b.homework.due_date)).slice(0, 3);
  const recentEvents = buildTimelineEvents({ enrolments, feeInvoices, homeworkEntries, guardianLinks, guardianById }).slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Date of birth" value={student.date_of_birth} />
          <Row label="Gender" value={student.gender} />
          <Row label="Blood group" value={student.blood_group} />
          <Row label="Phone" value={student.phone} />
          <Row label="Email" value={student.email} />
          <Row label="Address" value={[student.address_line1, student.city, student.state, student.pincode].filter(Boolean).join(", ") || null} />
          <Row label="Previous school" value={student.previous_school} />
          <Row label="Category" value={student.category} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Snapshot</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-medium">{attendancePct !== null ? `${attendancePct}%` : "No records yet"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fee outstanding</span>
            <span className="font-medium">{feeInvoices && feeInvoices.length > 0 ? `₹${totalOutstanding.toLocaleString("en-IN")}` : "No invoices yet"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Homework pending</span>
            <span className="font-medium">{pendingHomework.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Guardians linked</span>
            <span className="font-medium">{guardianLinks?.length ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {upcomingHomework.length === 0 && (
            <EmptyState icon={Clock} title="Nothing due" description="No pending assignments right now." />
          )}
          {upcomingHomework.map((e) => (
            <div key={e.homework.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <span>{e.homework.title}</span>
              <Badge variant="outline">Due {e.homework.due_date}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentEvents.length === 0 && <p className="text-muted-foreground">No recorded activity yet.</p>}
          {recentEvents.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <div>
                <p>{ev.title}</p>
                <p className="text-xs text-muted-foreground">{ev.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground">{ev.date}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || <span className="text-muted-foreground">Not recorded</span>}</span>
    </div>
  );
}
