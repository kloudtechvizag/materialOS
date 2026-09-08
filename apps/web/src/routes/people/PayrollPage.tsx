import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface PayrollRun {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross: string;
  total_net: string;
}

interface Advance {
  id: string;
  employee_id: string;
  amount: string;
  reason: string | null;
  status: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline", calculated: "secondary", pending_approval: "secondary", approved: "secondary",
  locked: "success", paid: "success", cancelled: "destructive",
};

/** /people/payroll (spec sec43-45). Run list + create; the calculate/
 * approve/lock/pay pipeline lives on PayrollRunDetailPage since each
 * step needs its own review surface (exceptions, payslip breakdown). */
export function PayrollPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ period_label: "", period_start: "", period_end: "" });

  const { data: runs, isLoading, error, refetch } = useQuery({ queryKey: ["payroll-runs"], queryFn: () => apiFetch<PayrollRun[]>("/payroll/runs") });
  const { data: advances } = useQuery({ queryKey: ["advances", "pending"], queryFn: () => apiFetch<Advance[]>("/advances?status=pending"), retry: false });

  const createRun = useMutation({
    mutationFn: () => apiFetch<PayrollRun>("/payroll/runs", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      setShowForm(false);
    },
  });

  const approveAdvance = useMutation({
    mutationFn: (id: string) => apiFetch(`/advances/${id}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advances"] }),
  });
  const payAdvance = useMutation({
    mutationFn: (id: string) => apiFetch(`/advances/${id}/pay`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advances"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Run, review, and approve payroll for each period.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New payroll run"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New payroll run</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input placeholder="September 2026" value={form.period_label} onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Period start</Label>
              <Input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Period end</Label>
              <Input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
            </div>
            {createRun.isError && <ErrorState error={createRun.error} />}
            <div className="sm:col-span-3">
              <Button onClick={() => createRun.mutate()} disabled={!form.period_label || !form.period_start || !form.period_end || createRun.isPending}>Create run</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {advances && advances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending advance requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {advances.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div><p>₹{Number(a.amount).toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">{a.reason}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => approveAdvance.mutate(a.id)}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => payAdvance.mutate(a.id)}>Mark paid</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {runs && runs.length === 0 && !showForm && <EmptyState icon={Wallet} title="No payroll runs yet" description="Create a run for the current period to get started." actionLabel="New payroll run" onAction={() => setShowForm(true)} />}

      {runs && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((run) => (
            <Link key={run.id} to={`/people/payroll/${run.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{run.period_label}</span>
                      <Badge variant={STATUS_VARIANT[run.status] ?? "outline"}>{run.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{run.period_start} to {run.period_end}</p>
                  </div>
                  <span className="text-lg font-semibold">₹{Number(run.total_net).toLocaleString("en-IN")}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
