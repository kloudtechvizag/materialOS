import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { Examination, ReportCard, Student, StudentEnrolment, SchoolClass, Section } from "./types";

export function ExaminationsTab({
  studentId, student, enrolments, classById, sectionById,
}: {
  studentId: string;
  student: Student;
  enrolments: StudentEnrolment[] | undefined;
  classById: Map<string, SchoolClass>;
  sectionById: Map<string, Section>;
}) {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const { data: examinations, isLoading, error } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const { data: reportCard, isFetching: reportCardLoading } = useQuery({
    queryKey: ["report-card", selectedExamId, studentId],
    queryFn: () => apiFetch<ReportCard>(`/examinations/${selectedExamId}/report-card/${studentId}`),
    enabled: !!selectedExamId,
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error) return <p className="text-sm text-destructive">Could not load examinations.</p>;
  if (!examinations || examinations.length === 0) {
    return <EmptyState icon={GraduationCap} title="No examinations yet" description="Once an examination is scheduled for this student's class, it will appear here." />;
  }

  const activeExamId = selectedExamId ?? examinations[0]?.id ?? null;
  const activeExam = examinations.find((e) => e.id === activeExamId) ?? null;
  const enrolment = enrolments?.find((e) => e.academic_year_id === activeExam?.academic_year_id) ?? null;
  const cls = enrolment ? classById.get(enrolment.school_class_id) : null;
  const section = enrolment?.section_id ? sectionById.get(enrolment.section_id) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {examinations.map((exam) => (
          <button
            key={exam.id}
            type="button"
            onClick={() => setSelectedExamId(exam.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${activeExamId === exam.id ? "border-primary bg-accent" : "border-input text-muted-foreground hover:bg-accent"}`}
          >
            {exam.name}{!exam.is_locked && " · Results pending"}
          </button>
        ))}
      </div>

      {reportCardLoading && <Skeleton className="h-40" />}
      {!reportCardLoading && reportCard && (
        <div data-print-area className="space-y-3 rounded-lg border border-border p-4">
          <div className="hidden print:block print:mb-4 print:text-center">
            <p className="text-lg font-semibold">Report Card</p>
            <p className="text-sm">{student.first_name} {student.last_name} ({student.admission_number})</p>
            <p className="text-xs text-muted-foreground">{cls ? `${cls.name}${section ? ` - ${section.name}` : ""} · ` : ""}{activeExam?.name}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{activeExam?.name}</p>
              <Badge variant={reportCard.overall_result === "pass" ? "success" : reportCard.overall_result === "fail" ? "destructive" : "outline"}>
                {reportCard.overall_result === "incomplete" ? "Incomplete" : reportCard.overall_result === "pass" ? "Pass" : "Fail"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {reportCard.percentage !== null && <span className="text-sm text-muted-foreground">{reportCard.percentage}% {reportCard.overall_grade ? `· Grade ${reportCard.overall_grade}` : ""}</span>}
              <Button variant="outline" size="sm" className="no-print h-7" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-1.5">Subject</th>
                <th className="py-1.5">Marks</th>
                <th className="py-1.5">Grade</th>
              </tr>
            </thead>
            <tbody>
              {reportCard.subjects.map((s) => (
                <tr key={s.subject_id} className="border-b border-border last:border-0">
                  <td className="py-1.5">{s.subject_name}</td>
                  <td className="py-1.5">{s.is_absent ? "Absent" : s.marks_obtained !== null ? `${s.marks_obtained} / ${s.max_marks}` : "Not marked"}</td>
                  <td className="py-1.5">{s.grade ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
