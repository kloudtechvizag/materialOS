import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface StockLedgerEntry {
  id: string;
  item_id: string;
  warehouse_id: string;
  movement_type: string;
  qty: string;
  rate: string;
  value: string;
  reference_type: string;
  occurred_at: string;
}

interface Item { id: string; name: string; }
interface Warehouse { id: string; name: string; }

const MOVEMENT_LABELS: Record<string, string> = {
  opening: "Opening stock", purchase: "Purchase", sale: "Sale", transfer_in: "Transfer in",
  transfer_out: "Transfer out", adjustment: "Adjustment", sales_return: "Sales return", purchase_return: "Purchase return",
};

/** Read-only view over StockLedger (models/inventory.py) -- append-only,
 * written by every purchase/sale/transfer/adjustment. This is the first
 * UI to read it back; it doesn't recompute anything, just lists what's
 * already there, newest first. See GET /stock-ledger. */
export function StockMovementsPage() {
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });
  const { data: movements, isLoading, error, refetch } = useQuery({
    queryKey: ["stock-ledger", itemId, warehouseId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (itemId) params.set("item_id", itemId);
      if (warehouseId) params.set("warehouse_id", warehouseId);
      const qs = params.toString();
      return apiFetch<StockLedgerEntry[]>(`/stock-ledger${qs ? `?${qs}` : ""}`);
    },
  });

  const itemById = new Map((items ?? []).map((i) => [i.id, i.name]));
  const warehouseById = new Map((warehouses ?? []).map((w) => [w.id, w.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock movements</h1>
        <p className="text-sm text-muted-foreground">Every purchase, sale, transfer, and adjustment that touched stock, newest first.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">All items</option>
          {items?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {movements && movements.length === 0 && (
        <EmptyState icon={ArrowLeftRight} title="No stock movements yet" description="Purchases, sales, transfers, and adjustments will show up here as they happen." />
      )}

      {movements && movements.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Date</th>
                <th className="p-3">Item</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3 text-muted-foreground">{new Date(m.occurred_at).toLocaleString("en-IN")}</td>
                  <td className="p-3">{itemById.get(m.item_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{warehouseById.get(m.warehouse_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</td>
                  <td className={`p-3 text-right ${Number(m.qty) < 0 ? "text-destructive" : ""}`}>{Number(m.qty).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-right text-muted-foreground">₹{Number(m.rate).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-right">₹{Number(m.value).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
