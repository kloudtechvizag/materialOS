import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface ChildSummary {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  relationship_type: string;
  school_class_name: string | null;
  section_name: string | null;
}

export function GuardianPortalDashboardPage() {
  const { data: children, isLoading } = useQuery({ queryKey: ["guardian-portal-children"], queryFn: () => apiFetch<ChildSummary[]>("/guardian-portal/children") });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My children</h1>
        <p className="text-sm text-muted-foreground">Attendance, homework, fees, timetable, and report cards.</p>
      </div>

      {isLoading && <Skeleton className="h-32" />}
      {children && children.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4" />
          <span>No students are linked to this account yet.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children?.map((child) => (
          <Link key={child.student_id} to={`/guardian-portal/children/${child.student_id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">{child.first_name} {child.last_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{child.admission_number}</p>
                <p>{child.school_class_name ?? "Not enrolled"}{child.section_name ? ` - ${child.section_name}` : ""}</p>
                <p className="text-xs capitalize">You are their {child.relationship_type}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
