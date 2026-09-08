import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ComponentHealth {
  name: string;
  status: string;
  latency_ms: number | null;
  detail: string | null;
}

interface SystemHealth {
  checked_at: string;
  overall: string;
  components: ComponentHealth[];
}

const STATUS_STYLES: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
  degraded: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  unavailable: "border-destructive/30 bg-destructive/5",
};

/** sec39-40: real, live checks -- every load re-queries the actual
 * database/redis/storage/worker, never a cached "all green". */
export function SystemHealthPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiFetch<SystemHealth>("/system-health"),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System health</h1>
          <p className="text-sm text-muted-foreground">Checked {new Date(data.checked_at).toLocaleTimeString()}.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Re-check now
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.components.map((c) => (
          <Card key={c.name} className={cn(STATUS_STYLES[c.status])}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base capitalize">
                {c.name.replace(/_/g, " ")}
                {c.status === "healthy" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium capitalize">{c.status}</p>
              {c.latency_ms !== null && <p className="text-muted-foreground">{c.latency_ms}ms round trip</p>}
              {c.detail && <p className="text-muted-foreground">{c.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
