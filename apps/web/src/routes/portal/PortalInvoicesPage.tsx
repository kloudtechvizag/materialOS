import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalInvoice } from "@/routes/portal/types";

export function PortalInvoicesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-invoices"], queryFn: () => apiFetch<PortalInvoice[]>("/portal/invoices"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Posted invoices on your account. Report a payment against any of them.</p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={Receipt} title="No invoices yet" description="Invoices raised against your dispatches will show up here." />}
      {data && data.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {data.map((inv) => (
              <Link key={inv.id} to={`/portal/invoices/${inv.id}`} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent">
                <div>
                  <span className="font-medium">{inv.number}</span>
                  <p className="text-xs text-muted-foreground">{inv.invoice_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={inv.status === "cancelled" ? "destructive" : "outline"}>{inv.status}</Badge>
                  <span className="font-semibold">{formatINR(inv.total)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
