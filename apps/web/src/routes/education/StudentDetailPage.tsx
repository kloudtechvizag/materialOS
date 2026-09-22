import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  BookOpen, Bus, CalendarCheck, ClipboardList, GraduationCap, History, IndianRupee, LayoutGrid, UsersRound, Building2, FilePenLine,
} from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

import { StudentHeader } from "./student360/StudentHeader";
import { NeedsAttention } from "./student360/NeedsAttention";
import { OverviewTab } from "./student360/OverviewTab";
import { AcademicsTab } from "./student360/AcademicsTab";
import { AttendanceTab } from "./student360/AttendanceTab";
import { FeesTab } from "./student360/FeesTab";
import { GuardiansTab } from "./student360/GuardiansTab";
import { HomeworkTab } from "./student360/HomeworkTab";
import { ExaminationsTab } from "./student360/ExaminationsTab";
import { TransportTab } from "./student360/TransportTab";
import { LibraryTab } from "./student360/LibraryTab";
import { HostelTab } from "./student360/HostelTab";
import { EnrolmentTab } from "./student360/EnrolmentTab";
import { TimelineTab } from "./student360/TimelineTab";
import type {
  AcademicYear, AttendanceRecord, Branch, Employee, Examination, FeeInvoiceSummary, Guardian, SchoolClass, Section,
  Student, StudentEnrolment, StudentGuardianLink, StudentHomeworkEntry, StudentTransport,
} from "./student360/types";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "academics", label: "Academics", icon: BookOpen },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fees", label: "Fees", icon: IndianRupee },
  { id: "guardians", label: "Guardians", icon: UsersRound },
  { id: "homework", label: "Homework", icon: FilePenLine },
  { id: "examinations", label: "Examinations", icon: GraduationCap },
  { id: "transport", label: "Transport", icon: Bus },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "hostel", label: "Hostel", icon: Building2 },
  { id: "enrolment", label: "Enrolment History", icon: ClipboardList },
  { id: "timeline", label: "Timeline", icon: History },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Essential summary -- everything the header, KPI strip, and Needs
  // Attention panel need, eagerly fetched once. Each individual tab
  // fetches its own deeper data only when it's actually opened (see
  // each Tab component's own useQuery) -- the ADR covers why this
  // split, not "fetch everything up front," matches the real
  // performance requirement.
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
  const { data: guardians } = useQuery({ queryKey: ["guardians"], queryFn: () => apiFetch<Guardian[]>("/guardians") });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: classes } = useQuery({
    queryKey: ["all-school-classes"],
    queryFn: async () => (await Promise.all((await apiFetch<AcademicYear[]>("/academic-years")).map((y) => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${y.id}`)))).flat(),
  });
  const { data: sections } = useQuery({ queryKey: ["all-sections"], queryFn: () => apiFetch<Section[]>("/sections") });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => apiFetch<Employee[]>("/employees") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance-history", studentId],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/student-attendance?student_id=${studentId}`),
  });
  const { data: feeInvoices } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: () => apiFetch<FeeInvoiceSummary[]>(`/students/${studentId}/fees`),
  });
  const { data: homeworkEntries } = useQuery({
    queryKey: ["student-homework", studentId],
    queryFn: () => apiFetch<StudentHomeworkEntry[]>(`/students/${studentId}/homework`),
  });
  const { data: examinations } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const { data: transport } = useQuery({
    queryKey: ["student-transport", studentId],
    queryFn: () => apiFetch<StudentTransport | null>(`/students/${studentId}/transport`),
  });

  const yearById = new Map((years ?? []).map((y) => [y.id, y]));
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));
  const sectionById = new Map((sections ?? []).map((s) => [s.id, s]));
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));
  const employeeById = new Map((employees ?? []).map((e) => [e.id, e]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b]));

  const currentYear = years?.find((y) => y.is_current) ?? null;
  const currentEnrolment = enrolments?.find((e) => e.academic_year_id === currentYear?.id) ?? null;
  const currentClass = currentEnrolment ? classById.get(currentEnrolment.school_class_id) ?? null : null;
  const currentSection = currentEnrolment?.section_id ? sectionById.get(currentEnrolment.section_id) ?? null : null;
  const currentTeacher = currentSection?.class_teacher_id ? employeeById.get(currentSection.class_teacher_id) ?? null : null;
  const branch = student ? branchById.get(student.branch_id) ?? null : null;

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!student) return null;

  const attendancePct = attendance && attendance.length > 0 ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100) : null;
  const totalOutstanding = (feeInvoices ?? []).reduce((sum, inv) => sum + Number(inv.outstanding), 0);
  const pendingHomeworkCount = (homeworkEntries ?? []).filter((e) => e.status === "pending").length;
  const nextExam = examinations && examinations.length > 0
    ? [...examinations].filter((e) => !e.is_locked).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    : null;

  return (
    <div className="space-y-4">
      {/* "Print profile" (header) prints this dedicated summary, not
          whichever tab happens to be open -- a tab's own content (a
          long table, an empty state) isn't what "print this student's
          profile" means. Only one data-print-area may be live at a
          time (see index.css's own comment on this), so the
          Examinations tab's report card print button is the only
          other data-print-area in this page, and never open at the
          same time as this one is what gets printed. */}
      {/* Only rendered outside the Examinations tab -- that tab owns
          its own data-print-area (the report card itself), and two
          simultaneous data-print-area elements would both claim the
          printed page (see index.css's own warning on this). */}
      {activeTab !== "examinations" && (
        <div data-print-area className="hidden print:block print:space-y-2">
          <p className="text-lg font-semibold">{student.first_name} {student.last_name} ({student.admission_number})</p>
          <p className="text-sm">
            {currentClass ? `${currentClass.name}${currentSection ? `-${currentSection.name}` : ""}` : "Not enrolled this year"}
            {currentEnrolment?.roll_number ? ` · Roll No. ${currentEnrolment.roll_number}` : ""} · {currentYear?.name ?? "-"}{branch ? ` · ${branch.name}` : ""}
          </p>
          <p className="text-sm">Status: {student.status} · Admitted {student.admission_date} · Class teacher: {currentTeacher ? `${currentTeacher.first_name} ${currentTeacher.last_name}` : "Not assigned"}</p>
          <p className="text-sm">Attendance: {attendancePct !== null ? `${attendancePct}%` : "No records"} · Fee outstanding: ₹{totalOutstanding.toLocaleString("en-IN")} · Homework pending: {pendingHomeworkCount}</p>
          <p className="text-sm">Guardians: {(links ?? []).map((l) => guardianById.get(l.guardian_id)?.full_name).filter(Boolean).join(", ") || "None linked"}</p>
        </div>
      )}

      <div className="no-print space-y-4">
      <StudentHeader
        student={student}
        currentEnrolment={currentEnrolment}
        currentClass={currentClass}
        currentSection={currentSection}
        currentTeacher={currentTeacher}
        currentYear={currentYear}
        branch={branch}
        onEditClick={() => setActiveTab("overview")}
        onGoToGuardians={() => setActiveTab("guardians")}
      />

      <NeedsAttention
        feeInvoices={feeInvoices}
        attendance={attendance}
        homeworkEntries={homeworkEntries}
        guardianLinks={links}
        guardianById={guardianById}
        onGoToTab={(tab) => setActiveTab(tab as TabId)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button type="button" className="text-left" onClick={() => setActiveTab("attendance")}>
          <KpiCard icon={CalendarCheck} color="violet" label="Attendance" value={attendancePct !== null ? `${attendancePct}%` : "No data"} />
        </button>
        <button type="button" className="text-left" onClick={() => setActiveTab("fees")}>
          <KpiCard icon={IndianRupee} color="orange" label="Fee balance" value={feeInvoices && feeInvoices.length > 0 ? `₹${totalOutstanding.toLocaleString("en-IN")}` : "No invoices"} />
        </button>
        <button type="button" className="text-left" onClick={() => setActiveTab("homework")}>
          <KpiCard icon={FilePenLine} color="sky" label="Homework" value={homeworkEntries && homeworkEntries.length > 0 ? `${pendingHomeworkCount} pending` : "No homework"} />
        </button>
        <button type="button" className="text-left" onClick={() => setActiveTab("examinations")}>
          <KpiCard icon={GraduationCap} color="emerald" label="Next exam" value={nextExam ? nextExam.name : "None scheduled"} />
        </button>
        <button type="button" className="text-left" onClick={() => setActiveTab("transport")}>
          <KpiCard icon={Bus} color="amber" label="Transport" value={transport ? transport.route_name : "Not assigned"} />
        </button>
        <button type="button" className="text-left" onClick={() => setActiveTab("guardians")}>
          <KpiCard icon={UsersRound} color="violet" label="Guardians" value={links ? `${links.length} linked` : "-"} />
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "overview" && (
          <OverviewTab student={student} enrolments={enrolments} attendance={attendance} feeInvoices={feeInvoices} homeworkEntries={homeworkEntries} guardianLinks={links} guardianById={guardianById} />
        )}
        {activeTab === "academics" && (
          <AcademicsTab studentId={student.id} currentEnrolment={currentEnrolment} currentSection={currentSection} currentTeacher={currentTeacher} />
        )}
        {activeTab === "attendance" && <AttendanceTab studentId={student.id} />}
        {activeTab === "fees" && <FeesTab studentId={student.id} />}
        {activeTab === "guardians" && <GuardiansTab studentId={student.id} />}
        {activeTab === "homework" && <HomeworkTab studentId={student.id} />}
        {activeTab === "examinations" && (
          <ExaminationsTab studentId={student.id} student={student} enrolments={enrolments} classById={classById} sectionById={sectionById} />
        )}
        {activeTab === "transport" && <TransportTab studentId={student.id} />}
        {activeTab === "library" && <LibraryTab studentId={student.id} />}
        {activeTab === "hostel" && <HostelTab studentId={student.id} />}
        {activeTab === "enrolment" && (
          <EnrolmentTab enrolments={enrolments} yearById={yearById} classById={classById} sectionById={sectionById} branchById={branchById} employeeById={employeeById} />
        )}
        {activeTab === "timeline" && (
          <TimelineTab studentId={student.id} enrolments={enrolments} feeInvoices={feeInvoices} homeworkEntries={homeworkEntries} guardianLinks={links} guardianById={guardianById} />
        )}
      </div>
      </div>
    </div>
  );
}
