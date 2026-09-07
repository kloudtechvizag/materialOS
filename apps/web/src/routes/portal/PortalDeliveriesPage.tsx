import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { PortalDeliveryChallan } from "@/routes/portal/types";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  dispatched: "secondary",
  in_transit: "secondary",
  delivered: "success",
  failed: "destructive",
};

export function PortalDeliveriesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-deliveries"], queryFn: () => apiFetch<PortalDeliveryChallan[]>("/portal/deliveries"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">Track dispatches against your orders.</p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={Truck} title="Nothing dispatched yet" description="Delivery challans against your orders will show up here." />}
      {data && data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">All deliveries</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{d.number}</span>
                  <p className="text-xs text-muted-foreground">{d.dispatch_date}</p>
                </div>
                <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>{d.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
