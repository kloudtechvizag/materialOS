import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDrawer } from "@/components/entities/EmployeeDrawer";
import { apiFetch } from "@/lib/api";
import {
  EMPLOYEE_STATUS_LABELS,
  employeeName,
  type Department,
  type Employee,
} from "@/lib/people";

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  active: "success", probation: "secondary", on_notice: "secondary", on_leave: "secondary",
  suspended: "destructive", inactive: "outline", resigned: "outline", terminated: "destructive", retired: "outline",
};

interface Branch { id: string; name: string; }
interface Designation { id: string; name: string; }

/** /people/employees (spec sec98's data table). */
export function EmployeesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data: employees, isLoading, error, refetch } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => apiFetch<Department[]>("/departments") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: designations } = useQuery({ queryKey: ["designations"], queryFn: () => apiFetch<Designation[]>("/designations") });

  const deptById = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const designationById = new Map((designations ?? []).map((d) => [d.id, d.name]));

  const pageCount = Math.max(1, Math.ceil((employees?.length ?? 0) / PAGE_SIZE));
  const pageEmployees = (employees ?? []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees?.length ?? 0} employees.</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Add employee</Button>
      </div>

      <EmployeeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {employees && employees.length === 0 && (
        <EmptyState icon={Users} title="No employees yet" description="Add your first employee to start tracking attendance, leave, and payroll." actionLabel="Add employee" onAction={() => setDrawerOpen(true)} />
      )}

      {employees && employees.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Employee code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {pageEmployees.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="p-3 text-muted-foreground">{e.employee_code}</td>
                    <td className="p-3">
                      <Link to={`/people/employees/${e.id}`} className="font-medium text-primary hover:underline">{employeeName(e)}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{e.designation_id ? designationById.get(e.designation_id) ?? "-" : "-"}</td>
                    <td className="p-3 text-muted-foreground">{e.department_id ? deptById.get(e.department_id) ?? "-" : "-"}</td>
                    <td className="p-3 text-muted-foreground">{branchById.get(e.branch_id) ?? "-"}</td>
                    <td className="p-3"><Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>{EMPLOYEE_STATUS_LABELS[e.status] ?? e.status}</Badge></td>
                    <td className="p-3">
                      <Link to={`/people/employees/${e.id}`} className="text-xs font-medium text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {page + 1} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
