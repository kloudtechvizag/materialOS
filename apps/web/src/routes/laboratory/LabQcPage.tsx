import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface TestDefinition { id: string; code: string; name: string }
interface ReferenceSample {
  id: string;
  test_definition_id: string;
  qc_type: string;
  name: string;
  lot_number: string | null;
  expiry_date: string | null;
  expected_low: string | null;
  expected_high: string | null;
}
interface QcRun {
  id: string;
  test_definition_id: string;
  qc_type: string;
  reference_sample_id: string | null;
  result_value: string;
  numeric_value: string | null;
  rpd_percent: string | null;
  status: string;
  performed_at: string;
}

const EMPTY_REFERENCE_FORM = { qc_type: "control", name: "", lot_number: "", expiry_date: "", expected_low: "", expected_high: "" };

export function LabQcPage() {
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [addReferenceOpen, setAddReferenceOpen] = useState(false);
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE_FORM);
  const [runDrafts, setRunDrafts] = useState<Record<string, string>>({});

  const { data: testDefs } = useQuery({ queryKey: ["lab-test-definitions"], queryFn: () => apiFetch<TestDefinition[]>("/lab/test-definitions") });
  const testId = selectedTestId || testDefs?.[0]?.id || "";

  const { data: references, isLoading: referencesLoading, error: referencesError } = useQuery({
    queryKey: ["lab-qc-references", testId],
    queryFn: () => apiFetch<ReferenceSample[]>(`/lab/qc-reference-samples?test_definition_id=${testId}`),
    enabled: !!testId,
  });
  const { data: runs, isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useQuery({
    queryKey: ["lab-qc-runs", testId],
    queryFn: () => apiFetch<QcRun[]>(`/lab/qc-runs?test_definition_id=${testId}`),
    enabled: !!testId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lab-qc-references", testId] });
    queryClient.invalidateQueries({ queryKey: ["lab-qc-runs", testId] });
  }

  const createReference = useMutation({
    mutationFn: () =>
      apiFetch<ReferenceSample>("/lab/qc-reference-samples", {
        method: "POST",
        body: {
          test_definition_id: testId, qc_type: referenceForm.qc_type, name: referenceForm.name,
          lot_number: referenceForm.lot_number || null, expiry_date: referenceForm.expiry_date || null,
          expected_low: referenceForm.expected_low || null, expected_high: referenceForm.expected_high || null,
        },
      }),
    onSuccess: () => {
      setAddReferenceOpen(false);
      setReferenceForm(EMPTY_REFERENCE_FORM);
      invalidate();
    },
  });

  const recordRun = useMutation({
    mutationFn: (referenceId: string) => apiFetch("/lab/qc-runs/reference", { method: "POST", body: { reference_sample_id: referenceId, result_value: runDrafts[referenceId] } }),
    onSuccess: () => invalidate(),
  });

  const activeTestDef = testDefs?.find((t) => t.id === testId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quality control</h1>
        <p className="text-sm text-muted-foreground">
          Blanks and controls compared against a reference sample's own acceptance range -- a failed run blocks authorizing that test's results until a fresh run passes.
        </p>
      </div>

      <div className="max-w-xs space-y-1.5">
        <Label>Test</Label>
        <select
          className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={testId}
          onChange={(e) => setSelectedTestId(e.target.value)}
        >
          {(testDefs ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} -- {t.name}</option>)}
        </select>
      </div>

      {!testId && <p className="text-sm text-muted-foreground">Add a test in the Test Catalog first.</p>}

      {testId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Reference samples</p>
              <Button size="sm" variant="outline" onClick={() => setAddReferenceOpen(true)}>Add</Button>
            </div>
            {referencesLoading && <Skeleton className="h-24" />}
            {referencesError && <ErrorState error={referencesError} />}
            {references && references.length === 0 && (
              <EmptyState icon={ShieldCheck} title="No reference samples" description="Add a blank or control for this test to start recording QC runs." />
            )}
            {references && references.length > 0 && (
              <div className="space-y-3">
                {references.map((r) => (
                  <div key={r.id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {r.qc_type}
                          {r.expected_low && r.expected_high ? ` · range ${r.expected_low}-${r.expected_high}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 max-w-[140px] text-xs"
                        placeholder="Result"
                        value={runDrafts[r.id] ?? ""}
                        onChange={(e) => setRunDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                      <Button size="sm" className="h-8 px-2 text-xs" disabled={!runDrafts[r.id] || recordRun.isPending} onClick={() => recordRun.mutate(r.id)}>
                        Record run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {recordRun.isError && <ErrorState error={recordRun.error} />}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="font-medium">Run history</p>
            {runsLoading && <Skeleton className="h-24" />}
            {runsError && <ErrorState error={runsError} onRetry={() => refetchRuns()} />}
            {runs && runs.length === 0 && <p className="text-sm text-muted-foreground">No QC runs recorded yet for {activeTestDef?.name}.</p>}
            {runs && runs.length > 0 && (
              <div className="divide-y divide-border">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="capitalize">
                        {run.qc_type} &middot; {run.result_value}
                        {run.rpd_percent ? ` (RPD ${run.rpd_percent}%)` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(run.performed_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={run.status === "pass" ? "success" : "destructive"}>{run.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={addReferenceOpen} onOpenChange={setAddReferenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New reference sample</DialogTitle>
            <DialogDescription>For {activeTestDef?.name} -- a blank or control with its own acceptance range.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={referenceForm.qc_type}
                onChange={(e) => setReferenceForm((f) => ({ ...f, qc_type: e.target.value }))}
              >
                <option value="control">Control</option>
                <option value="blank">Blank</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={referenceForm.name} onChange={(e) => setReferenceForm((f) => ({ ...f, name: e.target.value }))} placeholder="pH 7.00 Buffer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lot number</Label>
                <Input value={referenceForm.lot_number} onChange={(e) => setReferenceForm((f) => ({ ...f, lot_number: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry date</Label>
                <Input type="date" value={referenceForm.expiry_date} onChange={(e) => setReferenceForm((f) => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expected low</Label>
                <Input value={referenceForm.expected_low} onChange={(e) => setReferenceForm((f) => ({ ...f, expected_low: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expected high</Label>
                <Input value={referenceForm.expected_high} onChange={(e) => setReferenceForm((f) => ({ ...f, expected_high: e.target.value }))} />
              </div>
            </div>
          </div>
          {createReference.isError && <ErrorState error={createReference.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReferenceOpen(false)}>Cancel</Button>
            <Button onClick={() => createReference.mutate()} disabled={!referenceForm.name || createReference.isPending}>
              {createReference.isPending ? "Saving..." : "Save reference sample"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
