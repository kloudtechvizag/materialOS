import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { AlertTriangle, Calculator, CheckCircle2, Lock, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface PayrollRun {
  id: string;
  period_label: string;
  status: string;
  total_gross: string;
  total_deductions: string;
  total_net: string;
}

interface PayrollLineItem { code: string; name: string; amount: string; }
interface PayrollException { type: string; blocking: boolean; [key: string]: unknown; }
interface PayrollItem {
  id: string;
  employee_id: string;
  present_days: string;
  lop_days: string;
  gross_earnings: string;
  total_deductions: string;
  net_pay: string;
  earnings_breakdown: PayrollLineItem[];
  deductions_breakdown: PayrollLineItem[];
  exceptions: PayrollException[];
}

const EXCEPTION_LABELS: Record<string, string> = {
  missing_bank_details: "Missing bank details",
  missing_salary_structure: "No salary assigned",
  deductions_exceed_earnings: "Deductions exceed earnings this period",
  advance_deduction_deferred: "Advance deduction partially deferred",
};

/** /people/payroll/:runId -- the review/drill-down screen (spec
 * sec45-48): every employee's line-item breakdown, blocking vs
 * non-blocking exceptions called out explicitly, and the
 * calculate -> approve -> lock -> pay pipeline as real, gated actions. */
export function PayrollRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const queryClient = useQueryClient();

  const { data: run, isLoading, error, refetch } = useQuery({ queryKey: ["payroll-run", runId], queryFn: () => apiFetch<PayrollRun>(`/payroll/runs/${runId}`) });
  const { data: items } = useQuery({ queryKey: ["payroll-items", runId], queryFn: () => apiFetch<PayrollItem[]>(`/payroll/runs/${runId}/items`) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["payroll-run", runId] });
    queryClient.invalidateQueries({ queryKey: ["payroll-items", runId] });
  }

  const calculate = useMutation({ mutationFn: () => apiFetch(`/payroll/runs/${runId}/calculate`, { method: "POST" }), onSuccess: invalidate });
  const approve = useMutation({ mutationFn: () => apiFetch(`/payroll/runs/${runId}/approve`, { method: "POST" }), onSuccess: invalidate });
  const lock = useMutation({ mutationFn: () => apiFetch(`/payroll/runs/${runId}/lock`, { method: "POST" }), onSuccess: invalidate });
  const pay = useMutation({ mutationFn: () => apiFetch(`/payroll/runs/${runId}/pay`, { method: "POST" }), onSuccess: invalidate });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!run) return null;

  const blockingCount = items?.filter((i) => i.exceptions.some((e) => e.blocking)).length ?? 0;
  const activeError = calculate.error ?? approve.error ?? lock.error ?? pay.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{run.period_label}</h1>
          <Badge className="mt-1">{run.status.replace(/_/g, " ")}</Badge>
        </div>
        <div className="flex gap-2">
          {(run.status === "draft" || run.status === "calculated") && (
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending}><Calculator className="h-4 w-4" /> {run.status === "draft" ? "Calculate" : "Recalculate"}</Button>
          )}
          {run.status === "calculated" && (
            <Button onClick={() => approve.mutate()} disabled={approve.isPending || blockingCount > 0}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
          )}
          {run.status === "approved" && (
            <Button onClick={() => lock.mutate()} disabled={lock.isPending}><Lock className="h-4 w-4" /> Lock</Button>
          )}
          {run.status === "locked" && (
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}><Wallet className="h-4 w-4" /> Mark paid</Button>
          )}
        </div>
      </div>

      {/* The backend's own error message already names the blocking
          exception count (see approve_payroll_run's AppError) -- ErrorState
          renders it verbatim, no need to recompute it here. */}
      {activeError && <ErrorState error={activeError} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Gross</p><p className="text-xl font-semibold">₹{Number(run.total_gross).toLocaleString("en-IN")}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Deductions</p><p className="text-xl font-semibold">₹{Number(run.total_deductions).toLocaleString("en-IN")}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net pay</p><p className="text-xl font-semibold">₹{Number(run.total_net).toLocaleString("en-IN")}</p></CardContent></Card>
      </div>

      {blockingCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {blockingCount} employee(s) have blocking exceptions and must be fixed before this run can be approved.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Payslips</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(!items || items.length === 0) && <p className="text-sm text-muted-foreground">No items yet -- calculate this run.</p>}
          {items?.map((item) => (
            <details key={item.id} className="rounded-md border border-border p-3">
              <summary className="flex cursor-pointer items-center justify-between text-sm">
                <span>{item.present_days} present, {item.lop_days} LOP</span>
                <span className="font-semibold">₹{Number(item.net_pay).toLocaleString("en-IN")}</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Earnings</p>
                  {item.earnings_breakdown.map((l) => (
                    <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>₹{Number(l.amount).toLocaleString("en-IN")}</span></div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Deductions</p>
                  {item.deductions_breakdown.map((l) => (
                    <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>₹{Number(l.amount).toLocaleString("en-IN")}</span></div>
                  ))}
                </div>
              </div>
              {item.exceptions.length > 0 && (
                <div className="mt-3 space-y-1">
                  {item.exceptions.map((e, i) => (
                    <p key={i} className={`text-xs ${e.blocking ? "text-destructive" : "text-amber-600"}`}>
                      {e.blocking ? "⛔" : "⚠"} {EXCEPTION_LABELS[e.type as string] ?? e.type}
                    </p>
                  ))}
                </div>
              )}
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
