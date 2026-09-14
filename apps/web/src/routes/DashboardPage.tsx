import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGETS, type DashboardSummary } from "@/components/dashboard/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useIndustryProfile, type GoldenWorkflow } from "@/lib/industryProfile";

/** The trade/dealer flow every profile without its own bespoke
 * workflow falls back to -- still a real, working flow (Quotation,
 * SalesOrder, Dispatch, Invoice, Payment all genuinely exist), not a
 * placeholder. Laboratory and Printing override this via
 * IndustryProfile.golden_workflow (see ADR-022's golden-workflow
 * addendum) because their real transaction shape is different; every
 * other profile intentionally shares this one rather than 23 near-
 * identical copies of the same trade flow. */
const DEFAULT_GOLDEN_WORKFLOW: GoldenWorkflow = {
  cta_label: "New quotation",
  cta_href: "/quotations/new",
  steps: ["Approve", "Sales order", "Dispatch", "Invoice", "Payment"],
};

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
  });
  const { profile } = useIndustryProfile();
  const widgetKeys = profile?.dashboard_widgets ?? DEFAULT_DASHBOARD_WIDGETS;
  const workflow: GoldenWorkflow =
    profile?.golden_workflow?.cta_href && profile.golden_workflow.cta_label && profile.golden_workflow.steps
      ? (profile.golden_workflow as GoldenWorkflow)
      : DEFAULT_GOLDEN_WORKFLOW;

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
        <CardContent className="flex flex-wrap items-center gap-3">
          <Link to={workflow.cta_href} className="text-sm font-medium text-primary hover:underline">
            {workflow.cta_label}
          </Link>
          <span className="text-muted-foreground">→</span>
          <span className="text-sm text-muted-foreground">{workflow.steps.join(" → ")}</span>
        </CardContent>
      </Card>
    </div>
  );
}
