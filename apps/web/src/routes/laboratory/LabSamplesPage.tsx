import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface LabSample {
  id: string;
  sample_number: string;
  client_name: string;
  priority: string;
  status: string;
  collection_datetime: string | null;
  created_at: string;
}

interface Customer { id: string; name: string }
interface LabSampleType { id: string; code: string; name: string }
interface LabContainer { id: string; code: string; name: string }
interface LabTestDefinition { id: string; code: string; name: string }

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  registered: "outline",
  accessioned: "secondary",
  accepted: "secondary",
  rejected: "destructive",
  in_process: "secondary",
  completed: "success",
  reported: "success",
  cancelled: "destructive",
};

const EMPTY_FORM = { client_id: "", sample_type_id: "", container_id: "", priority: "routine", test_definition_ids: [] as string[] };

export function LabSamplesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newTypeName, setNewTypeName] = useState("");

  const { data: samples, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-samples"],
    queryFn: () => apiFetch<LabSample[]>("/lab/samples"),
  });
  const { data: customers } = useQuery({ queryKey: ["customers-for-lab"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: sampleTypes } = useQuery({ queryKey: ["lab-sample-types"], queryFn: () => apiFetch<LabSampleType[]>("/lab/sample-types") });
  const { data: containers } = useQuery({ queryKey: ["lab-containers"], queryFn: () => apiFetch<LabContainer[]>("/lab/containers") });
  const { data: testDefs } = useQuery({ queryKey: ["lab-test-definitions"], queryFn: () => apiFetch<LabTestDefinition[]>("/lab/test-definitions") });

  const addSampleType = useMutation({
    mutationFn: () => apiFetch<LabSampleType>("/lab/sample-types", { method: "POST", body: { code: newTypeName.toUpperCase().replace(/\s+/g, "_"), name: newTypeName } }),
    onSuccess: (created) => {
      setNewTypeName("");
      queryClient.invalidateQueries({ queryKey: ["lab-sample-types"] });
      setForm((f) => ({ ...f, sample_type_id: created.id }));
    },
  });

  const createSample = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/lab/samples", {
        method: "POST",
        body: { ...form, container_id: form.container_id || null },
      }),
    onSuccess: (sample) => {
      queryClient.invalidateQueries({ queryKey: ["lab-samples"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/lab/samples/${sample.id}`);
    },
  });

  function toggleTest(id: string) {
    setForm((f) => ({
      ...f,
      test_definition_ids: f.test_definition_ids.includes(id) ? f.test_definition_ids.filter((t) => t !== id) : [...f.test_definition_ids, id],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Samples</h1>
          <p className="text-sm text-muted-foreground">Register &rarr; accession &rarr; accept/reject &rarr; test &rarr; report.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Register sample</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {samples && samples.length === 0 && (
        <EmptyState icon={FlaskConical} title="No samples yet" description="Register your first sample to start the lab workflow." actionLabel="Register sample" onAction={() => setAddOpen(true)} />
      )}

      {samples && samples.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Sample #</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.id} className="cursor-pointer border-t border-border hover:bg-accent/50" onClick={() => navigate(`/lab/samples/${s.id}`)}>
                  <td className="px-4 py-2 font-medium text-primary">{s.sample_number}</td>
                  <td className="px-4 py-2">{s.client_name}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{s.priority}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{s.status.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register a sample</DialogTitle>
            <DialogDescription>Creates the sample and orders the selected tests -- accession it next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Select client...</option>
                {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sample type</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.sample_type_id}
                  onChange={(e) => setForm((f) => ({ ...f, sample_type_id: e.target.value }))}
                >
                  <option value="">Select type...</option>
                  {(sampleTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex gap-1.5 pt-1">
                  <Input className="h-8 text-xs" placeholder="New type..." value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
                  <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" disabled={!newTypeName || addSampleType.isPending} onClick={() => addSampleType.mutate()}>Add</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Container</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.container_id}
                  onChange={(e) => setForm((f) => ({ ...f, container_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {(containers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tests</Label>
              {(testDefs ?? []).length === 0 && <p className="text-xs text-muted-foreground">No tests in the catalog yet -- add one from Test Catalog first.</p>}
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {(testDefs ?? []).map((t) => (
                  <label key={t.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" checked={form.test_definition_ids.includes(t.id)} onChange={() => toggleTest(t.id)} />
                    <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {createSample.isError && <ErrorState error={createSample.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSample.mutate()}
              disabled={!form.client_id || !form.sample_type_id || form.test_definition_ids.length === 0 || createSample.isPending}
            >
              {createSample.isPending ? "Registering..." : "Register sample"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
