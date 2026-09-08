import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface SubscriptionPayment {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  method: string | null;
  failure_reason: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  pending: "secondary", succeeded: "success", failed: "destructive", refunded: "outline", partially_refunded: "outline",
};

/** Settings -> Subscription -> Payments (spec sec37). */
export function SubscriptionPaymentsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription-payments"],
    queryFn: () => apiFetch<SubscriptionPayment[]>("/subscription/payments"),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment history</h1>
        <p className="text-sm text-muted-foreground">Every payment attempt against your subscription invoices.</p>
      </div>

      {data && data.length === 0 && <EmptyState icon={CreditCard} title="No payments yet" description="Payment attempts appear here once you check out an invoice." />}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge>
                    <span className="text-sm capitalize text-muted-foreground">{p.method ?? p.provider}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                  {p.failure_reason && <p className="text-xs text-destructive">{p.failure_reason}</p>}
                </div>
                <span className="text-lg font-semibold">₹{Number(p.amount).toLocaleString("en-IN")}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
