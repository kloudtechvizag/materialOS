import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGETS, type DashboardSummary } from "@/components/dashboard/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useIndustryProfile } from "@/lib/industryProfile";

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
  });
  const { profile } = useIndustryProfile();
  const widgetKeys = profile?.dashboard_widgets ?? DEFAULT_DASHBOARD_WIDGETS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Outstanding, pipeline, and catalog size, live from Slice 1. Dispatch, procurement, and full accounting
          statements land as their slices ship.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgetKeys.map((key) => DASHBOARD_WIDGETS[key]?.(data)).filter(Boolean)}
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Start the golden transaction</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link to="/quotations/new" className="text-sm font-medium text-primary hover:underline">
            New quotation
          </Link>
          <span className="text-muted-foreground">→</span>
          <span className="text-sm text-muted-foreground">approve → sales order → dispatch → invoice → payment</span>
        </CardContent>
      </Card>
    </div>
  );
}
