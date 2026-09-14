import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { QuickAddCodeNameModal } from "@/components/entities/QuickAddCodeNameModal";
import { QuickAddContactModal } from "@/components/entities/QuickAddContactModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [quickAddSampleTypeOpen, setQuickAddSampleTypeOpen] = useState(false);
  const [quickAddContainerOpen, setQuickAddContainerOpen] = useState(false);

  const { data: samples, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-samples"],
    queryFn: () => apiFetch<LabSample[]>("/lab/samples"),
  });
  const { data: customers } = useQuery({ queryKey: ["customers-for-lab"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: sampleTypes } = useQuery({ queryKey: ["lab-sample-types"], queryFn: () => apiFetch<LabSampleType[]>("/lab/sample-types") });
  const { data: containers } = useQuery({ queryKey: ["lab-containers"], queryFn: () => apiFetch<LabContainer[]>("/lab/containers") });
  const { data: testDefs } = useQuery({ queryKey: ["lab-test-definitions"], queryFn: () => apiFetch<LabTestDefinition[]>("/lab/test-definitions") });

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
              <SearchableSelect
                options={(customers ?? []).map((c) => ({ id: c.id, label: c.name }))}
                value={form.client_id}
                onChange={(id) => setForm((f) => ({ ...f, client_id: id }))}
                placeholder="Select client..."
                searchPlaceholder="Search clients..."
                emptyText="No clients match."
                quickAddLabel="Quick Add Client"
                onQuickAdd={() => setQuickAddClientOpen(true)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sample type</Label>
                <SearchableSelect
                  options={(sampleTypes ?? []).map((t) => ({ id: t.id, label: t.name, sublabel: t.code }))}
                  value={form.sample_type_id}
                  onChange={(id) => setForm((f) => ({ ...f, sample_type_id: id }))}
                  placeholder="Select type..."
                  searchPlaceholder="Search sample types..."
                  emptyText="No sample types match."
                  quickAddLabel="Quick Add Sample Type"
                  onQuickAdd={() => setQuickAddSampleTypeOpen(true)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Container</Label>
                <SearchableSelect
                  options={(containers ?? []).map((c) => ({ id: c.id, label: c.name, sublabel: c.code }))}
                  value={form.container_id}
                  onChange={(id) => setForm((f) => ({ ...f, container_id: id }))}
                  placeholder="None"
                  searchPlaceholder="Search containers..."
                  emptyText="No containers match."
                  quickAddLabel="Quick Add Container"
                  onQuickAdd={() => setQuickAddContainerOpen(true)}
                />
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

      <QuickAddContactModal<Customer>
        open={quickAddClientOpen}
        onOpenChange={setQuickAddClientOpen}
        title="Client"
        endpoint="/customers"
        queryKey="customers-for-lab"
        onCreated={(client) => setForm((f) => ({ ...f, client_id: client.id }))}
      />
      <QuickAddCodeNameModal<LabSampleType>
        open={quickAddSampleTypeOpen}
        onOpenChange={setQuickAddSampleTypeOpen}
        title="Sample Type"
        endpoint="/lab/sample-types"
        queryKey="lab-sample-types"
        onCreated={(sampleType) => setForm((f) => ({ ...f, sample_type_id: sampleType.id }))}
      />
      <QuickAddCodeNameModal<LabContainer>
        open={quickAddContainerOpen}
        onOpenChange={setQuickAddContainerOpen}
        title="Container"
        endpoint="/lab/containers"
        queryKey="lab-containers"
        onCreated={(container) => setForm((f) => ({ ...f, container_id: container.id }))}
      />
    </div>
  );
}
