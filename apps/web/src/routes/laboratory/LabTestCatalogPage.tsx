import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Microscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface TestDefinition {
  id: string;
  code: string;
  name: string;
  category: string | null;
  method: string | null;
  result_type: string;
  unit: string | null;
  reference_range_low: string | null;
  reference_range_high: string | null;
  critical_low: string | null;
  critical_high: string | null;
  turnaround_hours: number | null;
}

const EMPTY_FORM = {
  code: "", name: "", category: "", method: "", result_type: "quantitative", unit: "",
  reference_range_low: "", reference_range_high: "", critical_low: "", critical_high: "", turnaround_hours: "",
};

export function LabTestCatalogPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tests, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-test-definitions"],
    queryFn: () => apiFetch<TestDefinition[]>("/lab/test-definitions"),
  });

  const createTest = useMutation({
    mutationFn: () =>
      apiFetch<TestDefinition>("/lab/test-definitions", {
        method: "POST",
        body: {
          code: form.code, name: form.name, category: form.category || null, method: form.method || null,
          result_type: form.result_type, unit: form.unit || null,
          reference_range_low: form.reference_range_low || null, reference_range_high: form.reference_range_high || null,
          critical_low: form.critical_low || null, critical_high: form.critical_high || null,
          turnaround_hours: form.turnaround_hours ? Number(form.turnaround_hours) : null,
        },
      }),
    onSuccess: () => {
      setAddOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["lab-test-definitions"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Test catalog</h1>
          <p className="text-sm text-muted-foreground">Every test a sample can be ordered against, with its method and reference range.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add test</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {tests && tests.length === 0 && (
        <EmptyState icon={Microscope} title="No tests defined yet" description="Add your first test to start ordering it on samples." actionLabel="Add test" onAction={() => setAddOpen(true)} />
      )}

      {tests && tests.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Reference range</th>
                <th className="px-4 py-2 font-medium">TAT</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{t.result_type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{t.unit ?? "--"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.reference_range_low && t.reference_range_high ? `${t.reference_range_low} - ${t.reference_range_high}` : "--"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{t.turnaround_hours ? `${t.turnaround_hours}h` : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New test</DialogTitle>
            <DialogDescription>Quantitative tests can be flagged automatically against the reference and critical ranges below.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="PH" />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="pH" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Chemistry" />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} placeholder="IS 3025" />
            </div>
            <div className="space-y-1.5">
              <Label>Result type</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.result_type}
                onChange={(e) => setForm((f) => ({ ...f, result_type: e.target.value }))}
              >
                <option value="quantitative">Quantitative</option>
                <option value="qualitative">Qualitative</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="mg/L" />
            </div>
            {form.result_type === "quantitative" && (
              <>
                <div className="space-y-1.5">
                  <Label>Reference range low</Label>
                  <Input value={form.reference_range_low} onChange={(e) => setForm((f) => ({ ...f, reference_range_low: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reference range high</Label>
                  <Input value={form.reference_range_high} onChange={(e) => setForm((f) => ({ ...f, reference_range_high: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Critical low</Label>
                  <Input value={form.critical_low} onChange={(e) => setForm((f) => ({ ...f, critical_low: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Critical high</Label>
                  <Input value={form.critical_high} onChange={(e) => setForm((f) => ({ ...f, critical_high: e.target.value }))} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Turnaround (hours)</Label>
              <Input type="number" value={form.turnaround_hours} onChange={(e) => setForm((f) => ({ ...f, turnaround_hours: e.target.value }))} />
            </div>
          </div>
          {createTest.isError && <ErrorState error={createTest.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createTest.mutate()} disabled={!form.code || !form.name || createTest.isPending}>
              {createTest.isPending ? "Saving..." : "Save test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
