import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGETS, type DashboardSummary } from "@/components/dashboard/widgets";
import { ReceivablesChart } from "@/components/dashboard/ReceivablesChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { WorkQueue } from "@/components/dashboard/WorkQueue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useIndustryProfile, type GoldenWorkflow } from "@/lib/industryProfile";

/** The trade/dealer flow every profile without its own bespoke
 * workflow falls back to -- still a real, working flow (Quotation,
 * SalesOrder, Dispatch, Invoice, Payment all genuinely exist), not a
 * placeholder. Laboratory and Printing override this via
 * IndustryProfile.golden_workflow (ADR-023) because their real
 * transaction shape is different; every other profile intentionally
 * shares this one rather than near-identical copies of the same flow. */
const DEFAULT_GOLDEN_WORKFLOW: GoldenWorkflow = {
  cta_label: "New quotation",
  cta_href: "/quotations/new",
  steps: ["Approve", "Sales order", "Dispatch", "Invoice", "Payment"],
};

interface CurrentUser {
  full_name: string;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
  });
  // Shares AppShell's own cache (identical queryKey + staleTime) -- one
  // /auth/me call for the whole app, not a second one just for this
  // greeting.
  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiFetch<CurrentUser>("/auth/me"),
    staleTime: Infinity,
  });
  const { profile, companyName } = useIndustryProfile();
  const widgetKeys = profile?.dashboard_widgets ?? DEFAULT_DASHBOARD_WIDGETS;
  const enabledModules = profile?.enabled_modules;
  const workflow: GoldenWorkflow =
    profile?.golden_workflow?.cta_href && profile.golden_workflow.cta_label && profile.golden_workflow.steps
      ? (profile.golden_workflow as GoldenWorkflow)
      : DEFAULT_GOLDEN_WORKFLOW;
  const usingDefaultWorkflow = workflow === DEFAULT_GOLDEN_WORKFLOW;

  const itemLabel = (profile?.terminology?.item_label ?? "item").toLowerCase();
  // Only real, working entry points -- Sales Order and Invoice have no
  // standalone "create" form anywhere in the app (a Sales Order only
  // ever comes from converting an approved Quotation, an Invoice only
  // from dispatching one), so neither appears here as a fake "+ create".
  const quickActions: { label: string; href: string }[] = [{ label: workflow.cta_label, href: workflow.cta_href }];
  if (enabledModules?.includes("sales") && workflow.cta_href !== "/quotations/new") {
    quickActions.push({ label: "New quotation", href: "/quotations/new" });
  }
  quickActions.push({ label: "Add customer", href: "/customers?new=1" });
  quickActions.push({ label: `Add ${itemLabel}`, href: "/items?new=1" });
  if (enabledModules?.includes("collections")) {
    quickActions.push({ label: "Collect payment", href: "/collections" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {me ? `${greeting()}, ${me.full_name.split(" ")[0]}. ` : ""}
            Business performance and daily operations{companyName ? ` for ${companyName}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile && <Badge variant="outline">{profile.name}</Badge>}
          <span className="text-xs text-muted-foreground">Updated {timeAgo(dataUpdatedAt)}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh dashboard"
            onClick={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ["current-user"] });
            }}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild size="sm">
            <Link to={workflow.cta_href}>+ Create</Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {widgetKeys.map((key) => DASHBOARD_WIDGETS[key]?.(data)).filter(Boolean)}
        </div>
      )}

      {!isLoading && (enabledModules === undefined || enabledModules.includes("accounting") || enabledModules.includes("collections")) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(enabledModules === undefined || enabledModules.includes("accounting")) && <SalesTrendChart />}
          {(enabledModules === undefined || enabledModules.includes("collections")) && <ReceivablesChart />}
        </div>
      )}

      {!isLoading && <WorkQueue enabledModules={enabledModules} />}

      {!isLoading && <RecentActivity />}

      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 text-sm font-semibold">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button key={action.href} asChild variant="outline" size="sm">
              <Link to={action.href}>+ {action.label}</Link>
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {workflow.steps.map((step, i) => {
            const count =
              usingDefaultWorkflow && data
                ? step === "Sales order"
                  ? data.open_sales_orders
                  : undefined
                : undefined;
            return (
              <span key={step} className="flex items-center gap-2">
                {i > 0 && <span>&rarr;</span>}
                <span>
                  {step}
                  {count !== undefined && <span className="ml-1 font-medium text-foreground">({count})</span>}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
