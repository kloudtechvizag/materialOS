import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";

import { WhatsAppSendModal } from "@/components/communication/WhatsAppSendModal";
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
  customer_id?: string;
  status: string;
  total: string;
  items: SalesOrderItem[];
}

interface CustomerInfo {
  id: string;
  name: string;
  phone?: string;
  billing_phone?: string;
  mobile?: string;
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
  const [waOpen, setWaOpen] = useState(false);

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["sales-order", orderId],
    queryFn: () => apiFetch<SalesOrder>(`/sales-orders/${orderId}`),
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", order?.customer_id],
    queryFn: () => apiFetch<CustomerInfo>(`/customers/${order!.customer_id}`),
    enabled: !!order?.customer_id,
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

  const recipientPhone = customer?.phone || customer?.billing_phone || customer?.mobile || "";
  const recipientName = customer?.name || "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{order.number}</h1>
            <Badge variant={order.status === "invoiced" ? "success" : "secondary"}>
              {STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>
          {customer && (
            <p className="text-xs text-muted-foreground mt-1">
              Customer: <span className="text-foreground font-medium">{customer.name}</span>
              {recipientPhone && (
                <span className="ml-1.5 font-mono text-emerald-400">({recipientPhone})</span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {order.status === "reserved" && <Button onClick={() => dispatch.mutate()} disabled={dispatch.isPending}>{dispatch.isPending ? "Dispatching..." : "Dispatch"}</Button>}
          {order.status === "dispatched" && <Button onClick={() => invoice.mutate()} disabled={invoice.isPending}>{invoice.isPending ? "Invoicing..." : "Create invoice"}</Button>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWaOpen(true)}
            className="gap-1.5 border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10"
          >
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </Button>
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

      <WhatsAppSendModal
        open={waOpen}
        onOpenChange={setWaOpen}
        recipientPhone={recipientPhone}
        recipientName={recipientName}
        defaultTemplateSlug="order_confirmation"
        defaultVariables={{
          order_number: order.number,
          customer_name: recipientName || "Valued Customer",
          amount: formatINR(order.total),
          status: STATUS_LABEL[order.status] ?? order.status,
        }}
        entityType="sales_order"
        entityId={order.id}
      />
    </div>
  );
}
