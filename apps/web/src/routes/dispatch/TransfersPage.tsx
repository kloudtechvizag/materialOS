import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Warehouse { id: string; name: string; }
interface Item { id: string; name: string; }
interface TransferItem { id: string; item_id: string; qty: string; }
interface Transfer { id: string; number: string; from_warehouse_id: string; to_warehouse_id: string; status: string; items: TransferItem[]; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  requested: "outline",
  dispatched: "secondary",
  received: "success",
};

export function TransfersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");

  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: transfers, isLoading, error, refetch } = useQuery({
    queryKey: ["transfers"], queryFn: () => apiFetch<Transfer[]>("/transfers"),
  });

  function warehouseName(id: string) {
    return warehouses?.find((w) => w.id === id)?.name ?? id;
  }

  const createTransfer = useMutation({
    mutationFn: () =>
      apiFetch<Transfer>("/transfers", {
        method: "POST",
        body: { from_warehouse_id: fromId, to_warehouse_id: toId, lines: [{ item_id: itemId, qty: Number(qty) }] },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setShowForm(false);
      setFromId(""); setToId(""); setItemId(""); setQty("");
    },
  });

  const dispatch = useMutation({
    mutationFn: (id: string) => apiFetch(`/transfers/${id}/dispatch`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfers"] }),
  });
  const receive = useMutation({
    mutationFn: (id: string) => apiFetch(`/transfers/${id}/receive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfers"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Warehouse transfers</h1>
          <p className="text-sm text-muted-foreground">Requested → dispatched → received, each leg a real stock movement.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New transfer"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New transfer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">From warehouse</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">To warehouse</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select className="col-span-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">Select item</option>
                {items?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <Input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            {createTransfer.isError && <ErrorState error={createTransfer.error} />}
            <Button onClick={() => createTransfer.mutate()} disabled={!fromId || !toId || !itemId || !qty || createTransfer.isPending}>
              {createTransfer.isPending ? "Creating..." : "Create transfer"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {transfers && transfers.length === 0 && !showForm && (
        <EmptyState icon={ArrowLeftRight} title="No transfers yet" description="Move stock between warehouses when a branch runs low." actionLabel="New transfer" onAction={() => setShowForm(true)} />
      )}

      {transfers && transfers.length > 0 && (
        <div className="space-y-3">
          {transfers.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-sm font-medium">{t.number}</p>
                  <p className="text-xs text-muted-foreground">{warehouseName(t.from_warehouse_id)} → {warehouseName(t.to_warehouse_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>{t.status}</Badge>
                  {t.status === "requested" && (
                    <Button size="sm" variant="outline" onClick={() => dispatch.mutate(t.id)} disabled={dispatch.isPending}>Dispatch</Button>
                  )}
                  {t.status === "dispatched" && (
                    <Button size="sm" variant="outline" onClick={() => receive.mutate(t.id)} disabled={receive.isPending}>Receive</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
