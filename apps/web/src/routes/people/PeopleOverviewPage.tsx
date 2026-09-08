import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, UserCheck, Users, UserX } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface DepartmentHeadcount {
  department_id: string | null;
  department_name: string;
  headcount: number;
}

interface PeopleOverview {
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  on_leave_today: number;
  pending_leave_requests: number;
  pending_advance_requests: number;
  department_distribution: DepartmentHeadcount[];
}

const KPI_CARDS: { key: keyof PeopleOverview; label: string; icon: React.ElementType; tone: string }[] = [
  { key: "total_employees", label: "Employees", icon: Users, tone: "text-foreground" },
  { key: "present_today", label: "Present today", icon: UserCheck, tone: "text-emerald-600" },
  { key: "absent_today", label: "Absent today", icon: UserX, tone: "text-destructive" },
  { key: "late_today", label: "Late today", icon: Clock, tone: "text-amber-600" },
  { key: "on_leave_today", label: "On leave", icon: Users, tone: "text-muted-foreground" },
];

/** /people (spec sec2) -- every number here is a live query against
 * real attendance/leave/employee rows, refreshed on load like every
 * other dashboard in this app (Command Center, System Health). */
export function PeopleOverviewPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["people-overview"],
    queryFn: () => apiFetch<PeopleOverview>("/people/overview"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">People & Payroll</h1>
        <p className="text-sm text-muted-foreground">Your workforce at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-semibold ${tone}`}>{data[key] as number}</p>
              </div>
              <Icon className={`h-6 w-6 ${tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pending approvals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Link to="/people/leave" className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent/50">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Leave requests</span>
              <span className="font-semibold">{data.pending_leave_requests}</span>
            </Link>
            <Link to="/people/payroll" className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent/50">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Advance requests</span>
              <span className="font-semibold">{data.pending_advance_requests}</span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Department distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.department_distribution.length === 0 && <p className="text-sm text-muted-foreground">No employees assigned to a department yet.</p>}
            {data.department_distribution.map((d) => (
              <div key={d.department_id ?? "unassigned"} className="flex items-center justify-between text-sm">
                <span>{d.department_name}</span>
                <span className="text-muted-foreground">{d.headcount}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
