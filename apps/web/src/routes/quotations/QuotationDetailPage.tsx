import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface QuotationItem {
  id: string;
  item_id: string;
  qty: string;
  uom: string;
  rate: string;
  cost: string;
  line_subtotal: string;
  line_tax: string;
  line_total: string;
}

interface Quotation {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  tax_total: string;
  total: string;
  total_cost: string;
  items: QuotationItem[];
}

interface Warehouse { id: string; name: string; }

export function QuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");

  const { data: quotation, isLoading, error, refetch } = useQuery({
    queryKey: ["quotation", quotationId],
    queryFn: () => apiFetch<Quotation>(`/quotations/${quotationId}`),
  });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiFetch<Warehouse[]>("/warehouses") });

  const approve = useMutation({
    mutationFn: () => apiFetch(`/quotations/${quotationId}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotation", quotationId] }),
  });

  const sendToCustomer = useMutation({
    mutationFn: () => apiFetch(`/quotations/${quotationId}/send`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotation", quotationId] }),
  });

  const convertToOrder = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/quotations/${quotationId}/convert-to-order`, {
        method: "POST",
        body: { warehouse_id: warehouseId },
      }),
    onSuccess: (order) => navigate(`/sales-orders/${order.id}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!quotation) return null;

  const margin = Number(quotation.subtotal) - Number(quotation.total_cost);
  const marginPercent = Number(quotation.subtotal) ? (margin / Number(quotation.subtotal)) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{quotation.number}</h1>
          <Badge variant={quotation.status === "converted" || quotation.status === "approved" ? "success" : quotation.status === "rejected" ? "destructive" : "outline"} className="mt-1">
            {quotation.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {quotation.status === "draft" && (
            <Button variant="outline" onClick={() => sendToCustomer.mutate()} disabled={sendToCustomer.isPending}>
              {sendToCustomer.isPending ? "Sending..." : "Send to customer"}
            </Button>
          )}
          {(quotation.status === "draft" || quotation.status === "sent") && (
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">Rate</th><th className="pb-2">Subtotal</th><th className="pb-2">Tax</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {quotation.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2">{formatINR(line.line_subtotal)}</td>
                  <td className="py-2">{formatINR(line.line_tax)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Margin at quote time</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground">Subtotal</p><p className="font-semibold">{formatINR(quotation.subtotal)}</p></div>
          <div><p className="text-muted-foreground">Tax</p><p className="font-semibold">{formatINR(quotation.tax_total)}</p></div>
          <div><p className="text-muted-foreground">Total</p><p className="font-semibold">{formatINR(quotation.total)}</p></div>
          <div><p className="text-muted-foreground">Margin</p><p className="font-semibold">{formatINR(margin)} ({marginPercent.toFixed(1)}%)</p></div>
        </CardContent>
      </Card>

      {quotation.status === "approved" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Convert to sales order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select warehouse to reserve from</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {convertToOrder.isError && <ErrorState error={convertToOrder.error} />}
            <Button onClick={() => convertToOrder.mutate()} disabled={!warehouseId || convertToOrder.isPending}>
              {convertToOrder.isPending ? "Creating order..." : "Create sales order & reserve stock"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
