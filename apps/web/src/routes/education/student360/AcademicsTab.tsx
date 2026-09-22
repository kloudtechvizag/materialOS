import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { Employee, Examination, ReportCard, Section, StudentEnrolment } from "./types";

interface SubjectSeries {
  subjectName: string;
  points: { examName: string; pct: number }[];
}

export function AcademicsTab({
  studentId, currentEnrolment, currentSection, currentTeacher,
}: {
  studentId: string;
  currentEnrolment: StudentEnrolment | null;
  currentSection: Section | null;
  currentTeacher: Employee | null;
}) {
  const { data: examinations } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const lockedExams = (examinations ?? []).filter((e) => e.is_locked).sort((a, b) => a.start_date.localeCompare(b.start_date));

  const { data: reportCards, isLoading } = useQuery({
    queryKey: ["academics-report-cards", studentId, lockedExams.map((e) => e.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        lockedExams.map((exam) => apiFetch<ReportCard>(`/examinations/${exam.id}/report-card/${studentId}`).then((rc) => ({ exam, rc })))
      );
      return results;
    },
    enabled: lockedExams.length > 0,
  });

  if (!examinations) return <Skeleton className="h-48" />;

  const current = reportCards?.[reportCards.length - 1];
  const previous = reportCards && reportCards.length > 1 ? reportCards[reportCards.length - 2] : null;

  const series: SubjectSeries[] = [];
  if (reportCards) {
    const bySubject = new Map<string, SubjectSeries>();
    for (const { exam, rc } of reportCards) {
      for (const s of rc.subjects) {
        if (s.marks_obtained === null) continue;
        const pct = Math.round((Number(s.marks_obtained) / Number(s.max_marks)) * 100);
        if (!bySubject.has(s.subject_name)) bySubject.set(s.subject_name, { subjectName: s.subject_name, points: [] });
        bySubject.get(s.subject_name)!.points.push({ examName: exam.name, pct });
      }
    }
    series.push(...bySubject.values());
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Current placement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Row label="Roll number" value={currentEnrolment?.roll_number} />
          <Row label="Section" value={currentSection?.name} />
          <Row label="Class teacher" value={currentTeacher ? `${currentTeacher.first_name} ${currentTeacher.last_name}` : undefined} />
          <Row label="Capacity" value={currentSection?.capacity ? `${currentSection.capacity} seats` : undefined} />
        </CardContent>
      </Card>

      {lockedExams.length === 0 && (
        <EmptyState icon={BookOpen} title="No assessment data yet" description="Once marks are entered and an examination is locked, subject performance will appear here." />
      )}

      {isLoading && lockedExams.length > 0 && <Skeleton className="h-40" />}

      {series.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Subject performance{current ? ` -- ${current.exam.name}` : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {series.map((s) => {
              const latest = s.points[s.points.length - 1];
              const prev = s.points.length > 1 ? s.points[s.points.length - 2] : null;
              const delta = prev ? latest.pct - prev.pct : null;
              return (
                <div key={s.subjectName} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{s.subjectName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${latest.pct}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-medium">{latest.pct}%</span>
                  {delta !== null && (
                    <span className={`w-14 shrink-0 text-right text-xs ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{delta}% vs prev
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {previous && current && (
        <p className="text-xs text-muted-foreground">
          Comparing {current.exam.name} against the previous locked examination, {previous.exam.name}.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || <span className="font-normal text-muted-foreground">Not recorded</span>}</p>
    </div>
  );
}
