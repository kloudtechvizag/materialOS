import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";
import type { AcademicYear, Branch, Employee, Section, SchoolClass, StudentEnrolment } from "./types";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  active: "success", promoted: "outline", repeated: "secondary", transferred: "destructive", withdrawn: "destructive",
};

export function EnrolmentTab({
  enrolments, yearById, classById, sectionById, branchById, employeeById,
}: {
  enrolments: StudentEnrolment[] | undefined;
  yearById: Map<string, AcademicYear>;
  classById: Map<string, SchoolClass>;
  sectionById: Map<string, Section>;
  branchById: Map<string, Branch>;
  employeeById: Map<string, Employee>;
}) {
  if (!enrolments || enrolments.length === 0) {
    return <EmptyState icon={History} title="Not enrolled in any academic year yet" description="Enrolment history builds up as this student is enrolled year over year -- promotions never overwrite a prior year's record." />;
  }

  const sorted = [...enrolments].sort((a, b) => b.enrolment_date.localeCompare(a.enrolment_date));

  return (
    <div className="space-y-2">
      {sorted.map((e, i) => {
        const year = yearById.get(e.academic_year_id);
        const cls = classById.get(e.school_class_id);
        const section = e.section_id ? sectionById.get(e.section_id) : null;
        const branch = cls ? branchById.get(cls.branch_id) : null;
        const teacher = section?.class_teacher_id ? employeeById.get(section.class_teacher_id) : null;
        return (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="font-medium">{year?.name ?? "-"}{i === 0 && <Badge variant="outline" className="ml-2">Current</Badge>}</p>
              <p className="text-sm">
                {cls?.name ?? "-"}{section ? `-${section.name}` : ""}{e.roll_number ? ` · Roll ${e.roll_number}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {branch ? `${branch.name} · ` : ""}{teacher ? `Class teacher: ${teacher.first_name} ${teacher.last_name} · ` : ""}
                From {e.enrolment_date}{year && i !== 0 ? ` through ${year.end_date}` : ""}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>{e.status}</Badge>
          </div>
        );
      })}
    </div>
  );
}
