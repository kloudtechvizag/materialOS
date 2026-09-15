import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Batch {
  id: string;
  item_id: string;
  warehouse_id: string;
  batch_code: string;
  manufactured_on: string | null;
  expiry_date: string | null;
  heat_number: string | null;
  cost: string;
}

interface Item { id: string; name: string; sku: string; }
interface Warehouse { id: string; name: string; }

const EMPTY_FORM = { item_id: "", warehouse_id: "", batch_code: "", manufactured_on: "", expiry_date: "", heat_number: "", cost: "0" };

/** Batch/lot tracking (models/catalog.py's Batch) -- batch code, mfg/
 * expiry dates, and steel's own heat_number, all real columns. Does
 * NOT track a quantity-per-batch (no such column exists yet -- see
 * StockLedger for actual quantity movements); this is a batch
 * identity/traceability register, not a stock count. */
export function BatchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });
  const { data: batches, isLoading, error, refetch } = useQuery({
    queryKey: ["batches"],
    queryFn: () => apiFetch<Batch[]>("/batches"),
  });

  const itemById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const warehouseById = new Map((warehouses ?? []).map((w) => [w.id, w.name]));

  const createBatch = useMutation({
    mutationFn: () =>
      apiFetch<Batch>("/batches", {
        method: "POST",
        body: {
          ...form,
          manufactured_on: form.manufactured_on || null,
          expiry_date: form.expiry_date || null,
          heat_number: form.heat_number.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Batches</h1>
          <p className="text-sm text-muted-foreground">Batch/lot codes, manufacture and expiry dates, and heat numbers per item.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add batch"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New batch</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Item</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.item_id} onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}>
                <option value="">Select item</option>
                {items?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">Select warehouse</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Batch code</Label>
              <Input value={form.batch_code} onChange={(e) => setForm((f) => ({ ...f, batch_code: e.target.value }))} placeholder="B-2024-06-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Heat number (steel)</Label>
              <Input value={form.heat_number} onChange={(e) => setForm((f) => ({ ...f, heat_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Manufactured on</Label>
              <Input type="date" value={form.manufactured_on} onChange={(e) => setForm((f) => ({ ...f, manufactured_on: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            {createBatch.isError && <ErrorState error={createBatch.error} />}
            <div className="sm:col-span-2">
              <Button onClick={() => createBatch.mutate()} disabled={!form.item_id || !form.warehouse_id || !form.batch_code || createBatch.isPending}>
                {createBatch.isPending ? "Saving..." : "Save batch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {batches && batches.length === 0 && !showForm && (
        <EmptyState icon={Layers} title="No batches yet" description="Track batch/lot codes and expiry per item as stock comes in." actionLabel="Add batch" onAction={() => setShowForm(true)} />
      )}

      {batches && batches.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Batch code</th>
                <th className="p-3">Item</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">Heat number</th>
                <th className="p-3">Manufactured</th>
                <th className="p-3">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3 font-medium">{b.batch_code}</td>
                  <td className="p-3 text-muted-foreground">{itemById.get(b.item_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{warehouseById.get(b.warehouse_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{b.heat_number ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{b.manufactured_on ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{b.expiry_date ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
