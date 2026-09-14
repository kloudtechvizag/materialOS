import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";

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
interface Customer { id: string; name: string }
interface SampleType { id: string; code: string; name: string }
interface Specification {
  id: string;
  test_definition_id: string;
  test_name: string;
  client_id: string | null;
  client_name: string | null;
  sample_type_id: string | null;
  sample_type_name: string | null;
  name: string;
  criteria_type: string;
  min_value: string | null;
  max_value: string | null;
  target_value: string | null;
  tolerance: string | null;
  text_value: string | null;
  is_active: boolean;
}

const EMPTY_FORM = {
  test_definition_id: "", client_id: "", sample_type_id: "", name: "", criteria_type: "range",
  min_value: "", max_value: "", target_value: "", tolerance: "", text_value: "",
};

function scopeLabel(spec: Specification): string {
  if (spec.client_name && spec.sample_type_name) return `${spec.client_name} · ${spec.sample_type_name}`;
  if (spec.client_name) return spec.client_name;
  if (spec.sample_type_name) return spec.sample_type_name;
  return "Default (all clients, all sample types)";
}

function criteriaLabel(spec: Specification): string {
  if (spec.criteria_type === "text") return `Must equal "${spec.text_value}"`;
  if (spec.min_value && spec.max_value) return `${spec.min_value} – ${spec.max_value}`;
  if (spec.min_value) return `≥ ${spec.min_value}`;
  if (spec.max_value) return `≤ ${spec.max_value}`;
  if (spec.target_value && spec.tolerance) return `${spec.target_value} ± ${spec.tolerance}`;
  return "--";
}

export function LabSpecificationsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: specs, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-specifications"],
    queryFn: () => apiFetch<Specification[]>("/lab/specifications"),
  });
  const { data: testDefs } = useQuery({ queryKey: ["lab-test-definitions"], queryFn: () => apiFetch<TestDefinition[]>("/lab/test-definitions") });
  const { data: customers } = useQuery({ queryKey: ["customers-for-lab"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: sampleTypes } = useQuery({ queryKey: ["lab-sample-types"], queryFn: () => apiFetch<SampleType[]>("/lab/sample-types") });

  const createSpec = useMutation({
    mutationFn: () =>
      apiFetch<Specification>("/lab/specifications", {
        method: "POST",
        body: {
          test_definition_id: form.test_definition_id,
          client_id: form.client_id || null,
          sample_type_id: form.sample_type_id || null,
          name: form.name,
          criteria_type: form.criteria_type,
          min_value: form.min_value || null,
          max_value: form.max_value || null,
          target_value: form.target_value || null,
          tolerance: form.tolerance || null,
          text_value: form.text_value || null,
        },
      }),
    onSuccess: () => {
      setAddOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["lab-specifications"] });
    },
  });

  const valid =
    form.test_definition_id &&
    form.name &&
    (form.criteria_type === "text" ? !!form.text_value : form.min_value || form.max_value || (form.target_value && form.tolerance));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Specifications</h1>
          <p className="text-sm text-muted-foreground">
            Pass/fail limits layered on top of each test's reference range -- optionally scoped to one client, one sample type, or both.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add specification</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {specs && specs.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="No specifications yet"
          description="Results are still flagged against each test's own reference range -- add a specification for a client- or sample-type-specific pass/fail limit."
          actionLabel="Add specification"
          onAction={() => setAddOpen(true)}
        />
      )}

      {specs && specs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Criteria</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.test_name}</td>
                  <td className="px-4 py-2">
                    <Badge variant={s.client_name || s.sample_type_name ? "secondary" : "outline"}>{scopeLabel(s)}</Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{criteriaLabel(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add specification</DialogTitle>
            <DialogDescription>Leave client and sample type unset for a tenant-wide default that applies unless a more specific one exists.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="M30 minimum compressive strength" />
            </div>
            <div className="space-y-1.5">
              <Label>Test</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.test_definition_id}
                onChange={(e) => setForm((f) => ({ ...f, test_definition_id: e.target.value }))}
              >
                <option value="">Select test...</option>
                {(testDefs ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} -- {t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client (optional)</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                >
                  <option value="">Any client</option>
                  {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sample type (optional)</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.sample_type_id}
                  onChange={(e) => setForm((f) => ({ ...f, sample_type_id: e.target.value }))}
                >
                  <option value="">Any sample type</option>
                  {(sampleTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Criteria type</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.criteria_type}
                onChange={(e) => setForm((f) => ({ ...f, criteria_type: e.target.value }))}
              >
                <option value="range">Numeric range</option>
                <option value="text">Exact text match</option>
              </select>
            </div>
            {form.criteria_type === "range" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Minimum</Label>
                    <Input value={form.min_value} onChange={(e) => setForm((f) => ({ ...f, min_value: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Maximum</Label>
                    <Input value={form.max_value} onChange={(e) => setForm((f) => ({ ...f, max_value: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Or set a target with a tolerance instead of min/max:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Target</Label>
                    <Input value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tolerance (&plusmn;)</Label>
                    <Input value={form.tolerance} onChange={(e) => setForm((f) => ({ ...f, tolerance: e.target.value }))} />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Expected text</Label>
                <Input value={form.text_value} onChange={(e) => setForm((f) => ({ ...f, text_value: e.target.value }))} placeholder="Absent" />
              </div>
            )}
          </div>
          {createSpec.isError && <ErrorState error={createSpec.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createSpec.mutate()} disabled={!valid || createSpec.isPending}>
              {createSpec.isPending ? "Saving..." : "Save specification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
