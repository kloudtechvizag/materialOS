import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface GRNItem { id: string; item_id: string; qty_received: string; rate: string; landed_unit_cost: string; qc_status: string; }
interface GoodsReceipt { id: string; number: string; status: string; landed_cost_total: string; items: GRNItem[]; }

export function GoodsReceiptDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [costType, setCostType] = useState("freight");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("value");

  const { data: receipt, isLoading, error, refetch } = useQuery({
    queryKey: ["goods-receipt", receiptId],
    queryFn: () => apiFetch<GoodsReceipt>(`/goods-receipts/${receiptId}`),
  });

  const addLandedCost = useMutation({
    mutationFn: () =>
      apiFetch(`/goods-receipts/${receiptId}/landed-cost`, {
        method: "POST",
        body: { cost_type: costType, amount: Number(amount), allocation_method: method },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipt", receiptId] });
      setAmount("");
    },
  });

  const createBill = useMutation({
    mutationFn: () => apiFetch<{ id: string }>(`/goods-receipts/${receiptId}/bill`, { method: "POST" }),
    onSuccess: (bill) => navigate(`/purchase-bills/${bill.id}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!receipt) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{receipt.number}</h1>
          <Badge variant="secondary" className="mt-1">{receipt.status}</Badge>
        </div>
        <Button onClick={() => createBill.mutate()} disabled={createBill.isPending}>
          {createBill.isPending ? "Creating bill..." : "Create purchase bill"}
        </Button>
      </div>
      {createBill.isError && <ErrorState error={createBill.error} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Received lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">PO rate</th><th className="pb-2">Landed unit cost</th><th className="pb-2">QC</th></tr>
            </thead>
            <tbody>
              {receipt.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty_received}</td>
                  <td className="py-2 text-muted-foreground">{formatINR(line.rate)}</td>
                  <td className="py-2 font-medium">{formatINR(line.landed_unit_cost)}</td>
                  <td className="py-2"><Badge variant={line.qc_status === "passed" ? "success" : "destructive"}>{line.qc_status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Landed cost (total so far: {formatINR(receipt.landed_cost_total)})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Cost type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={costType} onChange={(e) => setCostType(e.target.value)}>
                <option value="freight">Freight</option>
                <option value="loading">Loading</option>
                <option value="unloading">Unloading</option>
                <option value="insurance">Insurance</option>
                <option value="handling">Handling</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Allocate by</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="value">Value</option>
                <option value="quantity">Quantity</option>
              </select>
            </div>
          </div>
          {addLandedCost.isError && <ErrorState error={addLandedCost.error} />}
          <Button variant="outline" onClick={() => addLandedCost.mutate()} disabled={!amount || addLandedCost.isPending}>
            {addLandedCost.isPending ? "Adding..." : "Add cost"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
