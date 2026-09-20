import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface SalesOrder {
  id: string;
  number: string;
  status: string;
  total: string;
  order_date: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  credit_hold: "destructive",
  reserved: "secondary",
  dispatched: "secondary",
  invoiced: "success",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", credit_hold: "Credit hold", reserved: "Awaiting dispatch",
  dispatched: "Dispatched", invoiced: "Invoiced", cancelled: "Cancelled",
};

/** No standalone create form -- a Sales Order only ever comes from
 * converting an approved Quotation (POST /quotations/{id}/convert-to-
 * order), so unlike QuotationsPage there's no "+ New" button here. This
 * was previously the one Slice-1 entity with no list page at all (only
 * a detail route); added so the dashboard's "Orders awaiting dispatch"
 * work-queue row has somewhere real to send the user. */
export function SalesOrdersPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sales-orders", statusFilter],
    queryFn: () => apiFetch<SalesOrder[]>(`/sales-orders${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales orders</h1>
        <p className="text-sm text-muted-foreground">
          {statusFilter ? `Filtered to ${STATUS_LABEL[statusFilter] ?? statusFilter}.` : "Draft → reserved → dispatched → invoiced."}
        </p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState icon={ClipboardList} title="No sales orders" description="Sales orders appear here once a quotation is approved and converted." />
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
              {data.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <Link to={`/sales-orders/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{o.order_date}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                  <td className="px-4 py-2">{formatINR(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
