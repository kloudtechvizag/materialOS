import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface SalesOrderItem {
  id: string;
  qty: string;
  uom: string;
  rate: string;
  line_total: string;
  qty_dispatched: string;
}

interface SalesOrder {
  id: string;
  number: string;
  status: string;
  total: string;
  items: SalesOrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reserved: "Reserved",
  dispatched: "Dispatched",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export function SalesOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["sales-order", orderId],
    queryFn: () => apiFetch<SalesOrder>(`/sales-orders/${orderId}`),
  });

  const dispatch = useMutation({
    mutationFn: () => apiFetch(`/sales-orders/${orderId}/dispatch`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales-order", orderId] }),
  });

  const invoice = useMutation({
    mutationFn: () => apiFetch<{ id: string }>(`/sales-orders/${orderId}/invoice`, { method: "POST" }),
    onSuccess: (inv) => navigate(`/invoices/${inv.id}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.number}</h1>
          <Badge variant={order.status === "invoiced" ? "success" : "secondary"} className="mt-1">{STATUS_LABEL[order.status] ?? order.status}</Badge>
        </div>
        <div className="flex gap-2">
          {order.status === "reserved" && <Button onClick={() => dispatch.mutate()} disabled={dispatch.isPending}>{dispatch.isPending ? "Dispatching..." : "Dispatch"}</Button>}
          {order.status === "dispatched" && <Button onClick={() => invoice.mutate()} disabled={invoice.isPending}>{invoice.isPending ? "Invoicing..." : "Create invoice"}</Button>}
        </div>
      </div>

      {(dispatch.isError || invoice.isError) && <ErrorState error={dispatch.error ?? invoice.error} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty ordered</th><th className="pb-2">Dispatched</th><th className="pb-2">Rate</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2 text-muted-foreground">{line.qty_dispatched} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end text-lg font-semibold">Total: {formatINR(order.total)}</div>
    </div>
  );
}
