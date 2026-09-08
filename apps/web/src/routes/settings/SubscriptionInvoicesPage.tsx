import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface SubscriptionInvoice {
  id: string;
  invoice_number: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  total: string;
  currency: string;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline", open: "secondary", paid: "success", failed: "destructive", void: "outline", refunded: "outline",
};

/** Settings -> Subscription -> Invoices (spec sec36). */
export function SubscriptionInvoicesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: () => apiFetch<SubscriptionInvoice[]>("/subscription/invoices"),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">MaterialOS's own bills to your workspace for its subscription.</p>
      </div>

      {data && data.length === 0 && <EmptyState icon={FileText} title="No invoices yet" description="Invoices appear here once your first billing period completes or you change plans." />}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{inv.invoice_number}</span>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>{inv.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inv.billing_period_start} to {inv.billing_period_end} · issued {new Date(inv.issued_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-lg font-semibold">₹{Number(inv.total).toLocaleString("en-IN")}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
