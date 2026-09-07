import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_uom: string;
  gst_rate: string;
  standard_price: string;
  standard_cost: string;
  is_active: boolean;
}

function EditablePrice({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.standard_price);

  const update = useMutation({
    mutationFn: () => apiFetch(`/items/${item.id}`, { method: "PATCH", body: { standard_price: Number(value) } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        className="h-7 w-24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => update.mutate()}
        onKeyDown={(e) => e.key === "Enter" && update.mutate()}
      />
    );
  }

  const noPriceSet = Number(item.standard_price) === 0;
  return (
    <button
      onClick={() => setEditing(true)}
      className={noPriceSet ? "text-amber-600 underline decoration-dotted" : "hover:underline"}
      title="Click to edit"
    >
      {formatINR(item.standard_price)}
      {noPriceSet && " (set price)"}
    </button>
  );
}

export function ItemsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", base_uom: "PCS", gst_rate: "18", standard_price: "0", standard_cost: "0" });

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["items", q],
    queryFn: () => apiFetch<Item[]>(`/items${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const createItem = useMutation({
    mutationFn: () =>
      apiFetch<Item>("/items", {
        method: "POST",
        body: { ...form, gst_rate: Number(form.gst_rate), standard_price: Number(form.standard_price), standard_cost: Number(form.standard_cost) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setShowForm(false);
      setForm({ sku: "", name: "", base_uom: "PCS", gst_rate: "18", standard_price: "0", standard_cost: "0" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-sm text-muted-foreground">Selling price, cost, and GST rate live here -- quotations read straight from this.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add item"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="UltraTech OPC53 50KG" />
              </div>
              <div className="space-y-1.5">
                <Label>Base unit</Label>
                <Input value={form.base_uom} onChange={(e) => setForm((f) => ({ ...f, base_uom: e.target.value }))} placeholder="BAG" />
              </div>
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input type="number" value={form.gst_rate} onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Selling price</Label>
                <Input type="number" value={form.standard_price} onChange={(e) => setForm((f) => ({ ...f, standard_price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost</Label>
                <Input type="number" value={form.standard_cost} onChange={(e) => setForm((f) => ({ ...f, standard_cost: e.target.value }))} />
              </div>
            </div>
            {createItem.isError && <ErrorState error={createItem.error} />}
            <Button onClick={() => createItem.mutate()} disabled={!form.sku || !form.name || createItem.isPending}>
              {createItem.isPending ? "Saving..." : "Save item"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Search items..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {items && items.length === 0 && !showForm && (
        <EmptyState icon={Package} title="No items yet" description="Add your first item, or import your Tally/Busy catalog." actionLabel="Add item" onAction={() => setShowForm(true)} />
      )}

      {items && items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">GST</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{item.sku}</td>
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{item.base_uom}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{item.gst_rate}%</Badge></td>
                  <td className="px-4 py-2"><EditablePrice item={item} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{formatINR(item.standard_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
