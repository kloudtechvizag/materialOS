import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface TestOrder {
  id: string;
  test_definition_id: string;
  test_name: string;
  status: string;
  ordered_at: string;
}

interface Result {
  id: string;
  test_order_id: string;
  result_value: string;
  numeric_value: string | null;
  unit: string | null;
  flag: string | null;
  specification_result: string | null;
  status: string;
  entered_by_user_id: string;
  entered_at: string;
  validated_by_user_id: string | null;
  authorized_by_user_id: string | null;
}

interface SampleDetail {
  id: string;
  sample_number: string;
  client_name: string;
  priority: string;
  status: string;
  collection_datetime: string | null;
  received_datetime: string | null;
  rejection_reason: string | null;
  notes: string | null;
  current_location_id: string | null;
  current_location_name: string | null;
  test_orders: TestOrder[];
  results: Result[];
}

interface Report {
  id: string;
  report_number: string;
  version: number;
  status: string;
  generated_at: string;
  superseded_by_report_id: string | null;
}

interface StorageLocation { id: string; name: string; location_type: string }
interface CustodyEvent {
  id: string;
  event_type: string;
  from_location_name: string | null;
  to_location_name: string | null;
  performed_at: string;
  notes: string | null;
}

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  registered: "outline", accessioned: "secondary", accepted: "secondary", rejected: "destructive",
  in_process: "secondary", completed: "success", reported: "success", cancelled: "destructive",
};
const FLAG_VARIANT: Record<string, "success" | "destructive" | "secondary"> = { normal: "success", abnormal: "secondary", critical: "destructive" };
const CUSTODY_EVENT_TYPES = ["received", "stored", "moved", "checked_out", "checked_in", "disposed"];
const LOCATIONLESS_EVENTS = new Set(["checked_out", "disposed"]);

export function LabSampleDetailPage() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [custodyForm, setCustodyForm] = useState({ event_type: "stored", to_location_id: "", notes: "" });

  const { data: sample, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-sample", sampleId],
    queryFn: () => apiFetch<SampleDetail>(`/lab/samples/${sampleId}`),
  });
  const { data: reports } = useQuery({
    queryKey: ["lab-sample-reports", sampleId],
    queryFn: () => apiFetch<Report[]>(`/lab/samples/${sampleId}/reports`),
  });
  const { data: locations } = useQuery({
    queryKey: ["lab-storage-locations"],
    queryFn: () => apiFetch<StorageLocation[]>("/lab/storage-locations"),
  });
  const { data: custodyEvents } = useQuery({
    queryKey: ["lab-sample-custody", sampleId],
    queryFn: () => apiFetch<CustodyEvent[]>(`/lab/samples/${sampleId}/custody-events`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lab-sample", sampleId] });
    queryClient.invalidateQueries({ queryKey: ["lab-sample-reports", sampleId] });
    queryClient.invalidateQueries({ queryKey: ["lab-sample-custody", sampleId] });
    queryClient.invalidateQueries({ queryKey: ["lab-samples"] });
  }

  const accession = useMutation({ mutationFn: () => apiFetch(`/lab/samples/${sampleId}/accession`, { method: "POST" }), onSuccess: invalidate });
  const accept = useMutation({ mutationFn: () => apiFetch(`/lab/samples/${sampleId}/accept`, { method: "POST" }), onSuccess: invalidate });
  const reject = useMutation({
    mutationFn: () => apiFetch(`/lab/samples/${sampleId}/reject`, { method: "POST", body: { reason: rejectReason } }),
    onSuccess: () => { setRejectOpen(false); setRejectReason(""); invalidate(); },
  });
  const enterResult = useMutation({
    mutationFn: (testOrderId: string) => apiFetch(`/lab/test-orders/${testOrderId}/result`, { method: "POST", body: { result_value: resultDrafts[testOrderId] } }),
    onSuccess: invalidate,
  });
  const validateResult = useMutation({ mutationFn: (resultId: string) => apiFetch(`/lab/results/${resultId}/validate`, { method: "POST" }), onSuccess: invalidate });
  const authorizeResult = useMutation({ mutationFn: (resultId: string) => apiFetch(`/lab/results/${resultId}/authorize`, { method: "POST" }), onSuccess: invalidate });
  const generateReport = useMutation({ mutationFn: () => apiFetch(`/lab/samples/${sampleId}/report`, { method: "POST" }), onSuccess: invalidate });
  const supersedeReport = useMutation({ mutationFn: (reportId: string) => apiFetch(`/lab/reports/${reportId}/supersede`, { method: "POST" }), onSuccess: invalidate });
  const recordCustodyEvent = useMutation({
    mutationFn: () =>
      apiFetch(`/lab/samples/${sampleId}/custody-events`, {
        method: "POST",
        body: {
          event_type: custodyForm.event_type,
          to_location_id: LOCATIONLESS_EVENTS.has(custodyForm.event_type) ? null : custodyForm.to_location_id,
          notes: custodyForm.notes || null,
        },
      }),
    onSuccess: () => {
      setCustodyOpen(false);
      setCustodyForm({ event_type: "stored", to_location_id: "", notes: "" });
      invalidate();
    },
  });

  const anyMutationError = accession.error ?? accept.error ?? reject.error ?? enterResult.error ?? validateResult.error ?? authorizeResult.error ?? generateReport.error ?? supersedeReport.error;

  function resultFor(testOrderId: string): Result | undefined {
    return sample?.results.find((r) => r.test_order_id === testOrderId);
  }

  return (
    <div className="space-y-6">
      <Link to="/lab/samples" className="text-sm text-muted-foreground hover:text-foreground">&larr; All samples</Link>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {sample && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{sample.sample_number}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sample.client_name} &middot; <span className="capitalize">{sample.priority}</span> priority
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[sample.status] ?? "outline"}>{sample.status.replace("_", " ")}</Badge>
              {sample.status === "registered" && <Button size="sm" onClick={() => accession.mutate()} disabled={accession.isPending}>Accession</Button>}
              {sample.status === "accessioned" && (
                <>
                  <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending}>Accept</Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>Reject</Button>
                </>
              )}
              {sample.status === "completed" && <Button size="sm" onClick={() => generateReport.mutate()} disabled={generateReport.isPending}>Generate report</Button>}
            </div>
          </div>

          {sample.status === "rejected" && sample.rejection_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Rejected: {sample.rejection_reason}</div>
          )}

          {anyMutationError ? <ErrorState error={anyMutationError} /> : null}

          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">Tests &amp; results</div>
            <div className="divide-y divide-border">
              {sample.test_orders.map((order) => {
                const result = resultFor(order.id);
                return (
                  <div key={order.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{order.test_name}</p>
                      <Badge variant="outline">{order.status.replace("_", " ")}</Badge>
                    </div>
                    {!result && (sample.status === "accepted" || sample.status === "in_process") && (
                      <div className="flex items-center gap-2">
                        <Input
                          className="max-w-[160px]"
                          placeholder="Result value"
                          value={resultDrafts[order.id] ?? ""}
                          onChange={(e) => setResultDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
                        />
                        <Button size="sm" disabled={!resultDrafts[order.id] || enterResult.isPending} onClick={() => enterResult.mutate(order.id)}>Enter result</Button>
                      </div>
                    )}
                    {result && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-mono">{result.result_value}{result.unit ? ` ${result.unit}` : ""}</span>
                        {result.flag && <Badge variant={FLAG_VARIANT[result.flag] ?? "outline"}>{result.flag}</Badge>}
                        {result.specification_result && (
                          <Badge variant={result.specification_result === "pass" ? "success" : "destructive"}>
                            spec: {result.specification_result}
                          </Badge>
                        )}
                        <Badge variant="outline">{result.status}</Badge>
                        {result.status === "draft" && <Button size="sm" variant="outline" onClick={() => validateResult.mutate(result.id)} disabled={validateResult.isPending}>Validate</Button>}
                        {result.status === "validated" && <Button size="sm" variant="outline" onClick={() => authorizeResult.mutate(result.id)} disabled={authorizeResult.isPending}>Authorize</Button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">
              <span>Storage &amp; custody</span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCustodyOpen(true)}>Record event</Button>
            </div>
            <div className="p-4">
              <p className="text-sm">
                Current location: <span className="font-medium">{sample.current_location_name ?? "Not in tracked storage"}</span>
              </p>
              {custodyEvents && custodyEvents.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {custodyEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between text-sm">
                      <span className="capitalize">
                        {event.event_type.replace("_", " ")}
                        {event.from_location_name || event.to_location_name
                          ? `: ${event.from_location_name ?? "--"} → ${event.to_location_name ?? "--"}`
                          : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(event.performed_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {reports && reports.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">Reports</div>
              <div className="divide-y divide-border">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                    <div>
                      <p className="font-medium">{r.report_number} <span className="text-muted-foreground">v{r.version}</span></p>
                      <p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "released" ? "success" : "outline"}>{r.status}</Badge>
                      {r.status === "released" && <Button size="sm" variant="outline" onClick={() => supersedeReport.mutate(r.id)} disabled={supersedeReport.isPending}>Supersede</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {sample?.sample_number}</DialogTitle>
            <DialogDescription>A reason is required and is recorded on the sample.</DialogDescription>
          </DialogHeader>
          <Input placeholder="e.g. Sample leaked in transit" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          {reject.isError && <ErrorState error={reject.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={!rejectReason.trim() || reject.isPending}>Reject sample</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={custodyOpen} onOpenChange={setCustodyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record custody event</DialogTitle>
            <DialogDescription>Where this sample is going next -- appended to its permanent custody history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={custodyForm.event_type}
                onChange={(e) => setCustodyForm((f) => ({ ...f, event_type: e.target.value }))}
              >
                {CUSTODY_EVENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace("_", " ")}</option>)}
              </select>
            </div>
            {!LOCATIONLESS_EVENTS.has(custodyForm.event_type) && (
              <div className="space-y-1.5">
                <Label>Location</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={custodyForm.to_location_id}
                  onChange={(e) => setCustodyForm((f) => ({ ...f, to_location_id: e.target.value }))}
                >
                  <option value="">Select location...</option>
                  {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={custodyForm.notes} onChange={(e) => setCustodyForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          {recordCustodyEvent.isError && <ErrorState error={recordCustodyEvent.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustodyOpen(false)}>Cancel</Button>
            <Button
              onClick={() => recordCustodyEvent.mutate()}
              disabled={(!LOCATIONLESS_EVENTS.has(custodyForm.event_type) && !custodyForm.to_location_id) || recordCustodyEvent.isPending}
            >
              {recordCustodyEvent.isPending ? "Recording..." : "Record event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
