import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface WorksheetTestOrder {
  id: string;
  test_definition_id: string;
  test_name: string;
  status: string;
  ordered_at: string;
  sample_id: string;
  sample_number: string;
  client_name: string;
  worksheet_id: string | null;
}
interface QcRun {
  id: string;
  qc_type: string;
  reference_sample_id: string | null;
  result_value: string;
  rpd_percent: string | null;
  status: string;
  performed_at: string;
}
interface WorksheetDetail {
  id: string;
  worksheet_number: string;
  test_definition_id: string;
  test_name: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  test_orders: WorksheetTestOrder[];
  qc_runs: QcRun[];
}
interface ReferenceSample { id: string; qc_type: string; name: string; expected_low: string | null; expected_high: string | null }

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline"> = { open: "outline", in_progress: "secondary", completed: "success" };

export function LabWorksheetDetailPage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const queryClient = useQueryClient();
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const [qcDrafts, setQcDrafts] = useState<Record<string, string>>({});

  const { data: worksheet, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-worksheet", worksheetId],
    queryFn: () => apiFetch<WorksheetDetail>(`/lab/worksheets/${worksheetId}`),
  });
  const { data: unassigned } = useQuery({
    queryKey: ["lab-worksheet-unassigned", worksheet?.test_definition_id],
    queryFn: () => apiFetch<WorksheetTestOrder[]>(`/lab/test-orders/unassigned?test_definition_id=${worksheet!.test_definition_id}`),
    enabled: !!worksheet && worksheet.status === "open",
  });
  const { data: references } = useQuery({
    queryKey: ["lab-qc-references", worksheet?.test_definition_id],
    queryFn: () => apiFetch<ReferenceSample[]>(`/lab/qc-reference-samples?test_definition_id=${worksheet!.test_definition_id}`),
    enabled: !!worksheet,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lab-worksheet", worksheetId] });
    queryClient.invalidateQueries({ queryKey: ["lab-worksheet-unassigned", worksheet?.test_definition_id] });
    queryClient.invalidateQueries({ queryKey: ["lab-worksheets"] });
  }

  const addTestOrder = useMutation({
    mutationFn: (testOrderId: string) => apiFetch(`/lab/worksheets/${worksheetId}/test-orders`, { method: "POST", body: { test_order_id: testOrderId } }),
    onSuccess: invalidate,
  });
  const removeTestOrder = useMutation({
    mutationFn: (testOrderId: string) => apiFetch(`/lab/worksheets/${worksheetId}/test-orders/${testOrderId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const startWorksheet = useMutation({ mutationFn: () => apiFetch(`/lab/worksheets/${worksheetId}/start`, { method: "POST" }), onSuccess: invalidate });
  const completeWorksheet = useMutation({ mutationFn: () => apiFetch(`/lab/worksheets/${worksheetId}/complete`, { method: "POST" }), onSuccess: invalidate });
  const enterResult = useMutation({
    mutationFn: (testOrderId: string) => apiFetch(`/lab/test-orders/${testOrderId}/result`, { method: "POST", body: { result_value: resultDrafts[testOrderId] } }),
    onSuccess: invalidate,
  });
  const recordQcRun = useMutation({
    mutationFn: (referenceId: string) =>
      apiFetch("/lab/qc-runs/reference", { method: "POST", body: { reference_sample_id: referenceId, result_value: qcDrafts[referenceId], worksheet_id: worksheetId } }),
    onSuccess: invalidate,
  });

  const anyError = addTestOrder.error ?? removeTestOrder.error ?? startWorksheet.error ?? completeWorksheet.error ?? enterResult.error ?? recordQcRun.error;
  const latestQcStatus = worksheet?.qc_runs[0]?.status;

  return (
    <div className="space-y-6">
      <Link to="/lab/worksheets" className="text-sm text-muted-foreground hover:text-foreground">&larr; All worksheets</Link>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {worksheet && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{worksheet.worksheet_number}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{worksheet.test_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[worksheet.status] ?? "outline"}>{worksheet.status.replace("_", " ")}</Badge>
              {worksheet.status === "open" && (
                <Button size="sm" onClick={() => startWorksheet.mutate()} disabled={worksheet.test_orders.length === 0 || startWorksheet.isPending}>Start worksheet</Button>
              )}
              {worksheet.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => completeWorksheet.mutate()}
                  disabled={worksheet.test_orders.some((o) => o.status === "ordered") || completeWorksheet.isPending}
                >
                  Complete worksheet
                </Button>
              )}
            </div>
          </div>

          {latestQcStatus === "fail" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              This worksheet's most recent QC run failed -- record a passing QC run before authorizing results from it.
            </div>
          )}

          {anyError ? <ErrorState error={anyError} /> : null}

          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">Test orders on this worksheet</div>
            {worksheet.test_orders.length === 0 && <p className="p-4 text-sm text-muted-foreground">No test orders added yet.</p>}
            <div className="divide-y divide-border">
              {worksheet.test_orders.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {order.sample_number} <span className="font-normal text-muted-foreground">&middot; {order.client_name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{order.status.replace("_", " ")}</Badge>
                    {order.status === "ordered" && worksheet.status === "in_progress" && (
                      <>
                        <Input
                          className="h-8 max-w-[120px] text-xs"
                          placeholder="Result"
                          value={resultDrafts[order.id] ?? ""}
                          onChange={(e) => setResultDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
                        />
                        <Button size="sm" className="h-8 px-2 text-xs" disabled={!resultDrafts[order.id] || enterResult.isPending} onClick={() => enterResult.mutate(order.id)}>
                          Enter result
                        </Button>
                      </>
                    )}
                    {worksheet.status === "open" && (
                      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => removeTestOrder.mutate(order.id)} disabled={removeTestOrder.isPending}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {worksheet.status === "open" && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">Add test orders</div>
              {(unassigned ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No unassigned test orders for {worksheet.test_name} right now.</p>}
              <div className="divide-y divide-border">
                {(unassigned ?? []).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 text-sm">
                    <p>{order.sample_number} &middot; {order.client_name}</p>
                    <Button size="sm" variant="outline" onClick={() => addTestOrder.mutate(order.id)} disabled={addTestOrder.isPending}>Add</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">Worksheet QC</div>
            {worksheet.status !== "completed" && (
              <div className="divide-y divide-border">
                {(references ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No QC reference samples configured for {worksheet.test_name} yet.</p>}
                {(references ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {r.qc_type}
                        {r.expected_low && r.expected_high ? ` · range ${r.expected_low}-${r.expected_high}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 max-w-[120px] text-xs"
                        placeholder="Result"
                        value={qcDrafts[r.id] ?? ""}
                        onChange={(e) => setQcDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                      <Button size="sm" className="h-8 px-2 text-xs" disabled={!qcDrafts[r.id] || recordQcRun.isPending} onClick={() => recordQcRun.mutate(r.id)}>
                        Record run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Run history for this worksheet</p>
              {worksheet.qc_runs.length === 0 && <p className="text-sm text-muted-foreground">No QC runs recorded against this worksheet yet.</p>}
              <div className="space-y-2">
                {worksheet.qc_runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{run.qc_type} &middot; {run.result_value}{run.rpd_percent ? ` (RPD ${run.rpd_percent}%)` : ""}</span>
                    <Badge variant={run.status === "pass" ? "success" : "destructive"}>{run.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
