import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalSalesOrder } from "@/routes/portal/types";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  credit_hold: "destructive",
  reserved: "secondary",
  dispatched: "secondary",
  invoiced: "success",
  cancelled: "destructive",
};

export function PortalOrdersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-orders"], queryFn: () => apiFetch<PortalSalesOrder[]>("/portal/sales-orders"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Sales orders placed on your account.</p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders created from your approved quotations will show up here." />}
      {data && data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">All orders</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{o.number}</span>
                  <p className="text-xs text-muted-foreground">{o.order_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{o.status}</Badge>
                  <span className="font-semibold">{formatINR(o.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
