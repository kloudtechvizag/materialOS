import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, employeeName, type Employee } from "@/lib/people";

interface EmployeeHistoryEntry {
  id: string;
  event_type: string;
  description: string;
  effective_date: string;
  created_at: string;
}

interface Compensation {
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  pan_number: string | null;
}

interface SalaryAssignment {
  id: string;
  effective_date: string;
  monthly_gross: string;
  annual_ctc: string;
  basic: string;
  is_active: boolean;
}

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const queryClient = useQueryClient();
  const [salaryForm, setSalaryForm] = useState({ effective_date: "", annual_ctc: "", monthly_gross: "", basic: "" });

  const { data: employee, isLoading, error, refetch } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => apiFetch<Employee>(`/employees/${employeeId}`),
  });
  const { data: timeline } = useQuery({
    queryKey: ["employee-timeline", employeeId],
    queryFn: () => apiFetch<EmployeeHistoryEntry[]>(`/employees/${employeeId}/timeline`),
  });
  const { data: compensation, error: compensationError } = useQuery({
    queryKey: ["employee-compensation", employeeId],
    queryFn: () => apiFetch<Compensation>(`/employees/${employeeId}/compensation`),
    retry: false,
  });
  const { data: salaryHistory } = useQuery({
    queryKey: ["employee-salary", employeeId],
    queryFn: () => apiFetch<SalaryAssignment[]>(`/employees/${employeeId}/salary`),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiFetch<Employee>(`/employees/${employeeId}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-timeline", employeeId] });
    },
  });

  const assignSalary = useMutation({
    mutationFn: () => apiFetch<SalaryAssignment>(`/employees/${employeeId}/salary`, { method: "POST", body: salaryForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-salary", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-timeline", employeeId] });
      setSalaryForm({ effective_date: "", annual_ctc: "", monthly_gross: "", basic: "" });
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!employee) return null;

  const compensationForbidden = compensationError instanceof ApiError && compensationError.status === 403;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{employeeName(employee)}</h1>
          <p className="text-sm text-muted-foreground">{employee.employee_code} &middot; {EMPLOYMENT_TYPE_LABELS[employee.employment_type]}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{EMPLOYEE_STATUS_LABELS[employee.status] ?? employee.status}</Badge>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && updateStatus.mutate(e.target.value)}
          >
            <option value="">Change status...</option>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{employee.joining_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{employee.phone ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{employee.email ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Emergency contact</span><span>{employee.emergency_contact_name ?? "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {compensationForbidden && <p className="text-muted-foreground">You don&apos;t have permission to view salary/bank details.</p>}
            {compensation && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{compensation.bank_name ?? "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span>{compensation.bank_account_number ?? "-"}</span></div>
              </>
            )}
            {salaryHistory && salaryHistory.length > 0 && (
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Salary history</p>
                {salaryHistory.map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span className="text-muted-foreground">{s.effective_date}{s.is_active && " (current)"}</span>
                    <span>₹{Number(s.monthly_gross).toLocaleString("en-IN")}/mo</span>
                  </div>
                ))}
              </div>
            )}
            <details className="pt-1">
              <summary className="cursor-pointer text-xs text-primary">Assign new salary</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input placeholder="Effective date" type="date" value={salaryForm.effective_date} onChange={(e) => setSalaryForm((f) => ({ ...f, effective_date: e.target.value }))} />
                <Input placeholder="Annual CTC" value={salaryForm.annual_ctc} onChange={(e) => setSalaryForm((f) => ({ ...f, annual_ctc: e.target.value }))} />
                <Input placeholder="Monthly gross" value={salaryForm.monthly_gross} onChange={(e) => setSalaryForm((f) => ({ ...f, monthly_gross: e.target.value }))} />
                <Input placeholder="Basic" value={salaryForm.basic} onChange={(e) => setSalaryForm((f) => ({ ...f, basic: e.target.value }))} />
                <Button size="sm" className="col-span-2" onClick={() => assignSalary.mutate()} disabled={assignSalary.isPending}>Save</Button>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent>
          {(!timeline || timeline.length === 0) && <p className="text-sm text-muted-foreground">No events yet.</p>}
          <div className="space-y-3">
            {timeline?.map((event) => (
              <div key={event.id} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{event.effective_date}</span>
                <span>{event.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
