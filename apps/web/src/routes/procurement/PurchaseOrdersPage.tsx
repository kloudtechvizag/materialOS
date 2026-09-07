import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ItemSelect } from "@/components/items/ItemSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { CategoryLite } from "@/lib/items";

interface Supplier { id: string; name: string; }
interface Warehouse { id: string; name: string; }
interface Item { id: string; name: string; base_uom: string; standard_cost: string; category_id: string | null; }
interface PurchaseOrder { id: string; number: string; status: string; subtotal: string; po_date: string; }
interface Line { item_id: string; qty: string; rate: string; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  draft: "outline",
  approved: "secondary",
  partially_received: "secondary",
  received: "success",
};

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", qty: "", rate: "" }]);

  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => apiFetch<Supplier[]>("/suppliers") });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<CategoryLite[]>("/categories") });
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ["purchase-orders"], queryFn: () => apiFetch<PurchaseOrder[]>("/purchase-orders"),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      apiFetch<PurchaseOrder>("/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: supplierId, warehouse_id: warehouseId,
          lines: lines.filter((l) => l.item_id && l.qty && l.rate).map((l) => ({ item_id: l.item_id, qty: Number(l.qty), rate: Number(l.rate) })),
        },
      }),
    onSuccess: (order) => navigate(`/purchase-orders/${order.id}`),
  });

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const validLines = lines.filter((l) => l.item_id && l.qty && l.rate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">Order → receive → landed cost → bill → payment.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New purchase order"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New purchase order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Receive into warehouse</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <ItemSelect
                  className="col-span-6"
                  items={items}
                  categories={categories}
                  value={line.item_id}
                  onChange={(itemId) => {
                    const selected = items?.find((it) => it.id === itemId);
                    updateLine(i, { item_id: itemId, rate: line.rate || selected?.standard_cost || "" });
                  }}
                />
                <Input className="col-span-2" type="number" placeholder="Qty" value={line.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
                <Input className="col-span-3" type="number" placeholder="Rate" value={line.rate} onChange={(e) => updateLine(i, { rate: e.target.value })} />
                <button className="col-span-1 flex justify-end text-muted-foreground hover:text-destructive" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { item_id: "", qty: "", rate: "" }])}>
              <Plus className="h-4 w-4" /> Add line
            </Button>

            {createOrder.isError && <ErrorState error={createOrder.error} />}
            <Button onClick={() => createOrder.mutate()} disabled={!supplierId || !warehouseId || validLines.length === 0 || createOrder.isPending}>
              {createOrder.isPending ? "Creating..." : "Create purchase order"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {orders && orders.length === 0 && !showForm && (
        <EmptyState icon={ShoppingCart} title="No purchase orders yet" description="Create your first purchase order to bring stock in from a supplier." actionLabel="New purchase order" onAction={() => setShowForm(true)} />
      )}

      {orders && orders.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Number</th><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Total</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer border-t border-border hover:bg-accent/50" onClick={() => navigate(`/purchase-orders/${o.id}`)}>
                  <td className="px-4 py-2 font-medium text-primary">{o.number}</td>
                  <td className="px-4 py-2 text-muted-foreground">{o.po_date}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{o.status}</Badge></td>
                  <td className="px-4 py-2">{formatINR(o.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
