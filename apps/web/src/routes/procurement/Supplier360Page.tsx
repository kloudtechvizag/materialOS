import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Supplier360 {
  supplier: { id: string; name: string; gstin: string | null; billing_state: string | null };
  payable: string;
  open_purchase_orders: number;
  posted_bills: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export function Supplier360Page() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["supplier-360", supplierId],
    queryFn: () => apiFetch<Supplier360>(`/suppliers/${supplierId}/360`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.supplier.name}</h1>
        <p className="text-sm text-muted-foreground">{data.supplier.gstin ?? "No GSTIN"} · {data.supplier.billing_state ?? "No state on file"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payable &amp; pipeline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          <Stat label="Payable" value={formatINR(data.payable)} />
          <Stat label="Open purchase orders" value={data.open_purchase_orders} />
          <Stat label="Posted bills" value={data.posted_bills} />
        </CardContent>
      </Card>
    </div>
  );
}
