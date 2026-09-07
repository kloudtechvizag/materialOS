import { useQuery } from "@tanstack/react-query";
import { AlertCircle, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface AgeingLine {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  due_date: string;
  amount_due: string;
  days_overdue: number;
  bucket: string;
  reason: string;
}

interface Dso { period_days: number; dso: string | null; }

const BUCKET_VARIANT: Record<string, "outline" | "secondary" | "destructive"> = {
  current: "outline",
  "1-15": "secondary",
  "16-30": "secondary",
  "31-45": "destructive",
  "46+": "destructive",
};

export function CollectionsPage() {
  const { data: dso, isLoading: loadingDso } = useQuery({ queryKey: ["dso"], queryFn: () => apiFetch<Dso>("/collections/dso") });
  const { data: priority, isLoading: loadingPriority, error, refetch } = useQuery({
    queryKey: ["collections-priority"], queryFn: () => apiFetch<AgeingLine[]>("/collections/priority"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Collections</h1>
        <p className="text-sm text-muted-foreground">
          Priority is a plain rule (amount due, then days overdue) -- explainable, not AI. Real learned prioritization is Slice 5.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Days Sales Outstanding</CardTitle></CardHeader>
        <CardContent>
          {loadingDso ? (
            <Skeleton className="h-12 w-32" />
          ) : (
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-primary" />
              <div>
                <p className="text-3xl font-bold">{dso?.dso ?? "—"} {dso?.dso && "days"}</p>
                <p className="text-xs text-muted-foreground">Trailing {dso?.period_days} days. This is the number Slice 3's acceptance test tracks.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Today's priority collections</CardTitle></CardHeader>
        <CardContent>
          {loadingPriority && <Skeleton className="h-40" />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {priority && priority.length === 0 && (
            <EmptyState icon={AlertCircle} title="Nothing overdue" description="Every posted invoice is either current or fully paid." />
          )}
          {priority && priority.length > 0 && (
            <div className="space-y-2">
              {priority.map((line, i) => (
                <div key={line.invoice_id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                    <div>
                      <Link to={`/customers/${line.customer_id}`} className="font-medium text-primary hover:underline">{line.customer_name}</Link>
                      <p className="text-xs text-muted-foreground">{line.invoice_number} · {line.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={BUCKET_VARIANT[line.bucket] ?? "outline"}>{line.bucket}</Badge>
                    <span className="font-semibold">{formatINR(line.amount_due)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
