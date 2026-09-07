import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalQuotation } from "@/routes/portal/types";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  approved: "success",
  converted: "success",
  rejected: "destructive",
};

export function PortalQuotationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-quotations"], queryFn: () => apiFetch<PortalQuotation[]>("/portal/quotations"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="text-sm text-muted-foreground">Review and approve quotations sent to you.</p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={FileText} title="No quotations yet" description="Quotations sent to you will show up here." />}
      {data && data.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {data.map((q) => (
              <Link key={q.id} to={`/portal/quotations/${q.id}`} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent">
                <div>
                  <span className="font-medium">{q.number}</span>
                  <p className="text-xs text-muted-foreground">{q.quote_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>{q.status}</Badge>
                  <span className="font-semibold">{formatINR(q.total)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
