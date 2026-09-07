import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Warehouse { id: string; name: string; }
interface Item { id: string; name: string; }
interface StockCount { id: string; warehouse_id: string; count_date: string; status: string; items: { id: string }[]; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  draft: "outline",
  submitted: "secondary",
  approved: "success",
};

export function StockCountsPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: counts, isLoading, error, refetch } = useQuery({
    queryKey: ["stock-counts"], queryFn: () => apiFetch<StockCount[]>("/stock-counts"),
  });

  const createCount = useMutation({
    mutationFn: () =>
      apiFetch<StockCount>("/stock-counts", {
        method: "POST",
        body: { warehouse_id: warehouseId, item_ids: Array.from(selectedItems) },
      }),
    onSuccess: (count) => navigate(`/stock-counts/${count.id}`),
  });

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock counts</h1>
          <p className="text-sm text-muted-foreground">Blind counts: variance is only visible after you submit, before approval posts the adjustment.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Start count"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Start a blind count</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select warehouse</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {items?.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-accent/50">
                  <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItem(item.id)} />
                  {item.name}
                </label>
              ))}
            </div>
            {createCount.isError && <ErrorState error={createCount.error} />}
            <Button onClick={() => createCount.mutate()} disabled={!warehouseId || selectedItems.size === 0 || createCount.isPending}>
              {createCount.isPending ? "Starting..." : `Start count (${selectedItems.size} items)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {counts && counts.length === 0 && !showForm && (
        <EmptyState icon={ClipboardList} title="No stock counts yet" description="Start a blind count for a godown to reconcile book stock against what's physically there." actionLabel="Start count" onAction={() => setShowForm(true)} />
      )}

      {counts && counts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {counts.map((c) => (
            <Card key={c.id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => navigate(`/stock-counts/${c.id}`)}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{c.count_date}</span>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                </div>
                <p className="mt-1 text-sm">{c.items.length} items</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
