import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalInvoice, PortalQuotation, PortalSalesOrder, PortalStatementLine } from "@/routes/portal/types";

export function PortalDashboardPage() {
  const { data: quotations, isLoading: loadingQ } = useQuery({
    queryKey: ["portal-quotations"], queryFn: () => apiFetch<PortalQuotation[]>("/portal/quotations"),
  });
  const { data: orders, isLoading: loadingO } = useQuery({
    queryKey: ["portal-orders"], queryFn: () => apiFetch<PortalSalesOrder[]>("/portal/sales-orders"),
  });
  const { data: invoices, isLoading: loadingI } = useQuery({
    queryKey: ["portal-invoices"], queryFn: () => apiFetch<PortalInvoice[]>("/portal/invoices"),
  });
  const { data: statement, isLoading: loadingS } = useQuery({
    queryKey: ["portal-statement"], queryFn: () => apiFetch<PortalStatementLine[]>("/portal/statement"),
  });

  const currentBalance = statement && statement.length > 0 ? statement[statement.length - 1].balance : "0";
  const pendingQuotations = quotations?.filter((q) => q.status === "sent").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="text-sm text-muted-foreground">Quotations, orders, invoices, and your running balance in one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding balance</CardTitle></CardHeader>
          <CardContent>{loadingS ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{formatINR(currentBalance)}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Awaiting your approval</CardTitle></CardHeader>
          <CardContent>{loadingQ ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{pendingQuotations}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open orders</CardTitle></CardHeader>
          <CardContent>{loadingO ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{orders?.filter((o) => o.status !== "invoiced" && o.status !== "cancelled").length ?? 0}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle></CardHeader>
          <CardContent>{loadingI ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{invoices?.length ?? 0}</p>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent quotations</CardTitle></CardHeader>
        <CardContent>
          {loadingQ && <Skeleton className="h-24" />}
          {quotations && quotations.length === 0 && <p className="text-sm text-muted-foreground">No quotations yet.</p>}
          {quotations && quotations.length > 0 && (
            <div className="space-y-2">
              {quotations.slice(0, 5).map((q) => (
                <Link key={q.id} to={`/portal/quotations/${q.id}`} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-accent">
                  <span className="font-medium">{q.number}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant={q.status === "approved" || q.status === "converted" ? "success" : "outline"}>{q.status}</Badge>
                    <span className="font-semibold">{formatINR(q.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
