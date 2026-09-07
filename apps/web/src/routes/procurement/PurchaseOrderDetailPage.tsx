import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface POItem { id: string; item_id: string; qty: string; uom: string; rate: string; line_total: string; qty_received: string; }
interface PurchaseOrder { id: string; number: string; status: string; subtotal: string; items: POItem[]; }

export function PurchaseOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [qcStatus, setQcStatus] = useState<Record<string, string>>({});

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["purchase-order", orderId],
    queryFn: () => apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`),
  });

  const approve = useMutation({
    mutationFn: () => apiFetch(`/purchase-orders/${orderId}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-order", orderId] }),
  });

  const receive = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/purchase-orders/${orderId}/receive`, {
        method: "POST",
        body: {
          lines: (order?.items ?? [])
            .filter((line) => receiveQty[line.id])
            .map((line) => ({
              purchase_order_item_id: line.id,
              qty_received: Number(receiveQty[line.id]),
              qc_status: qcStatus[line.id] ?? "passed",
            })),
        },
      }),
    onSuccess: (receipt) => navigate(`/goods-receipts/${receipt.id}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return null;

  const pendingLines = order.items.filter((line) => Number(line.qty_received) < Number(line.qty));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.number}</h1>
          <Badge variant={order.status === "received" ? "success" : "secondary"} className="mt-1">{order.status}</Badge>
        </div>
        {order.status === "draft" && <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>}
      </div>

      {approve.isError && <ErrorState error={approve.error} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty ordered</th><th className="pb-2">Received</th><th className="pb-2">Rate</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2 text-muted-foreground">{line.qty_received} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(order.status === "approved" || order.status === "partially_received") && pendingLines.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Receive goods</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pendingLines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-5 text-sm">{line.qty} {line.uom} ordered, {Number(line.qty) - Number(line.qty_received)} pending</span>
                <Input className="col-span-3" type="number" placeholder="Qty received" onChange={(e) => setReceiveQty((prev) => ({ ...prev, [line.id]: e.target.value }))} />
                <select
                  className="col-span-4 flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(e) => setQcStatus((prev) => ({ ...prev, [line.id]: e.target.value }))}
                  defaultValue="passed"
                >
                  <option value="passed">QC passed</option>
                  <option value="failed">QC failed</option>
                </select>
              </div>
            ))}
            {receive.isError && <ErrorState error={receive.error} />}
            <Button onClick={() => receive.mutate()} disabled={receive.isPending}>
              {receive.isPending ? "Recording receipt..." : "Record goods receipt"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
