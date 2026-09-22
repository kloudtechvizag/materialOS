import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronDown, Contact, IndianRupee, MoreHorizontal, Pencil, Printer, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiFetch, ApiError } from "@/lib/api";
import { STATUS_LABELS, type AcademicYear, type Branch, type Section, type SchoolClass, type Student, type StudentEnrolment, type Employee } from "./types";

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function StudentHeader({
  student, currentEnrolment, currentClass, currentSection, currentTeacher, currentYear, branch, onEditClick, onGoToGuardians,
}: {
  student: Student;
  currentEnrolment: StudentEnrolment | null;
  currentClass: SchoolClass | null;
  currentSection: Section | null;
  currentTeacher: Employee | null;
  currentYear: AcademicYear | null;
  branch: Branch | null;
  onEditClick: () => void;
  onGoToGuardians: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiFetch<Student>(`/students/${student.id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      setPendingStatus(null);
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* No student-photo upload yet (named, deferred to a follow-up
              pass -- see the ADR); a real, legible initials avatar
              stands in rather than a placeholder icon or a fake photo. */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(student.first_name, student.last_name)}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{student.first_name} {student.last_name}</h1>
              <Badge variant={student.status === "active" ? "success" : student.status === "withdrawn" || student.status === "transferred" ? "destructive" : "outline"}>
                {STATUS_LABELS[student.status] ?? student.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{student.admission_number}</p>
            <p className="text-sm">
              {currentClass ? `${currentClass.name}${currentSection ? `-${currentSection.name}` : ""}` : "Not enrolled this year"}
              {currentEnrolment?.roll_number ? ` · Roll No. ${currentEnrolment.roll_number}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentYear?.name ?? "-"}{branch ? ` · ${branch.name}` : ""}{currentTeacher ? ` · Class teacher: ${currentTeacher.first_name} ${currentTeacher.last_name}` : ""} · Admitted {student.admission_date}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onEditClick}>
            <Pencil className="h-3.5 w-3.5" /> Edit student
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/student-attendance")}>
            <CalendarCheck className="h-3.5 w-3.5" /> Mark attendance
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/fees")}>
            <IndianRupee className="h-3.5 w-3.5" /> Collect fee
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print profile
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="h-3.5 w-3.5" /> More <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowStatusMenu(true)}>
                <Contact className="h-3.5 w-3.5" /> Change status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGoToGuardians}>
                <UserPlus className="h-3.5 w-3.5" /> Add guardian
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showStatusMenu && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-sm font-medium">Change status:</span>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={pendingStatus ?? ""}
            onChange={(e) => setPendingStatus(e.target.value || null)}
          >
            <option value="">Select status...</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button size="sm" className="h-9" disabled={!pendingStatus || updateStatus.isPending} onClick={() => pendingStatus && updateStatus.mutate(pendingStatus)}>
            {updateStatus.isPending ? "Saving..." : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => { setShowStatusMenu(false); setPendingStatus(null); }}>Cancel</Button>
          {updateStatus.error instanceof ApiError && <p className="w-full text-xs text-destructive">{updateStatus.error.message}</p>}
          <p className="w-full text-xs text-muted-foreground">Recorded in the student's real audit history (More &rarr; View audit history).</p>
        </div>
      )}
    </div>
  );
}
