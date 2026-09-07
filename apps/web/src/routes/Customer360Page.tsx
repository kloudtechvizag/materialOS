import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Customer360 {
  customer: { id: string; name: string; gstin: string | null; billing_state: string | null; credit_limit: string; credit_days: number };
  outstanding: string;
  available_credit: string;
  open_quotations: number;
  open_sales_orders: number;
  posted_invoices: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export function Customer360Page() {
  const { customerId } = useParams<{ customerId: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-360", customerId],
    queryFn: () => apiFetch<Customer360>(`/customers/${customerId}/360`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.customer.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.customer.gstin ?? "No GSTIN"} · {data.customer.billing_state ?? "No state on file"}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Outstanding &amp; credit</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Outstanding" value={formatINR(data.outstanding)} />
          <Stat label="Credit limit" value={formatINR(data.customer.credit_limit)} />
          <Stat label="Available credit" value={formatINR(data.available_credit)} />
          <Stat label="Credit days" value={data.customer.credit_days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          <Stat label="Open quotations" value={data.open_quotations} />
          <Stat label="Open sales orders" value={data.open_sales_orders} />
          <Stat label="Posted invoices" value={data.posted_invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
