import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Quotation {
  id: string;
  number: string;
  status: string;
  total: string;
  quote_date: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  approved: "secondary",
  converted: "success",
  rejected: "destructive",
};

export function QuotationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => apiFetch<Quotation[]>("/quotations"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
          <p className="text-sm text-muted-foreground">Margin and stock availability show before you send.</p>
        </div>
        <Button asChild><Link to="/quotations/new">New quotation</Link></Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState icon={FileText} title="No quotations yet" description="Create your first quotation from a customer's requirement." actionLabel="New quotation" onAction={() => (window.location.href = "/quotations/new")} />
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} className="cursor-pointer border-t border-border hover:bg-accent/50" onClick={() => (window.location.href = `/quotations/${q.id}`)}>
                  <td className="px-4 py-2 font-medium text-primary">{q.number}</td>
                  <td className="px-4 py-2 text-muted-foreground">{q.quote_date}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>{q.status}</Badge></td>
                  <td className="px-4 py-2">{formatINR(q.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
