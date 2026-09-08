import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  employeeName,
  type Department,
  type Employee,
} from "@/lib/people";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  active: "success", probation: "secondary", on_notice: "secondary", on_leave: "secondary",
  suspended: "destructive", inactive: "outline", resigned: "outline", terminated: "destructive", retired: "outline",
};

interface Branch { id: string; name: string; }

/** /people/employees (spec sec98's data table). */
export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", joining_date: "", branch_id: "", department_id: "", employment_type: "full_time" });

  const { data: employees, isLoading, error, refetch } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => apiFetch<Department[]>("/departments") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });

  const deptById = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const createEmployee = useMutation({
    mutationFn: () => apiFetch<Employee>("/employees", { method: "POST", body: { ...form, department_id: form.department_id || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setForm({ first_name: "", last_name: "", joining_date: "", branch_id: "", department_id: "", employment_type: "full_time" });
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees?.length ?? 0} employees.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ Add employee"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New employee</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Joining date</Label>
              <Input type="date" value={form.joining_date} onChange={(e) => setForm((f) => ({ ...f, joining_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.branch_id} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
                <option value="">Select branch</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {createEmployee.isError && <ErrorState error={createEmployee.error} />}
            <div className="sm:col-span-2">
              <Button onClick={() => createEmployee.mutate()} disabled={!form.first_name || !form.last_name || !form.joining_date || !form.branch_id || createEmployee.isPending}>
                {createEmployee.isPending ? "Creating..." : "Create employee"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {employees && employees.length === 0 && !showForm && (
        <EmptyState icon={Users} title="No employees yet" description="Add your first employee to start tracking attendance, leave, and payroll." actionLabel="Add employee" onAction={() => setShowForm(true)} />
      )}

      {employees && employees.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Employee</th>
                <th className="p-3">Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3">
                    <Link to={`/people/employees/${e.id}`} className="font-medium text-primary hover:underline">{employeeName(e)}</Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{e.employee_code}</td>
                  <td className="p-3 text-muted-foreground">{e.department_id ? deptById.get(e.department_id) ?? "-" : "-"}</td>
                  <td className="p-3 text-muted-foreground">{EMPLOYMENT_TYPE_LABELS[e.employment_type] ?? e.employment_type}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>{EMPLOYEE_STATUS_LABELS[e.status] ?? e.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
