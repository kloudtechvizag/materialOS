import { useQuery } from "@tanstack/react-query";
import { FileText, Package, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Summary {
  total_outstanding: string;
  total_invoiced: string;
  open_quotations: number;
  open_sales_orders: number;
  posted_invoices: number;
  active_items: number;
  active_customers: number;
}

function Kpi({ icon: Icon, label, value, to }: { icon: React.ElementType; label: string; value: string | number; to?: string }) {
  const content = (
    <Card className={to ? "transition-colors hover:bg-accent/50" : undefined}>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<Summary>("/dashboard/summary"),
  });

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
          <Kpi icon={TrendingUp} label="Total outstanding" value={formatINR(data.total_outstanding)} to="/customers" />
          <Kpi icon={TrendingUp} label="Total invoiced" value={formatINR(data.total_invoiced)} />
          <Kpi icon={FileText} label="Open quotations" value={data.open_quotations} to="/quotations" />
          <Kpi icon={FileText} label="Open sales orders" value={data.open_sales_orders} />
          <Kpi icon={Package} label="Active items" value={data.active_items} to="/items" />
          <Kpi icon={Users} label="Active customers" value={data.active_customers} to="/customers" />
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
