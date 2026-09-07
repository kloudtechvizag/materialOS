import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalStatementLine } from "@/routes/portal/types";

export function PortalStatementPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-statement"], queryFn: () => apiFetch<PortalStatementLine[]>("/portal/statement"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Statement</h1>
        <p className="text-sm text-muted-foreground">Every invoice and payment, with a running balance.</p>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={Wallet} title="No account activity yet" description="Invoices and payments will show up here as a running balance." />}
      {data && data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Account activity</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Document</th>
                  <th className="pb-2 text-right">Debit</th>
                  <th className="pb-2 text-right">Credit</th>
                  <th className="pb-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((line, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">{line.entry_date}</td>
                    <td className="py-2">
                      <span className="font-medium">{line.doc_number}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{line.doc_type.replace("_", " ")}</span>
                    </td>
                    <td className="py-2 text-right">{Number(line.debit) > 0 ? formatINR(line.debit) : "—"}</td>
                    <td className="py-2 text-right">{Number(line.credit) > 0 ? formatINR(line.credit) : "—"}</td>
                    <td className="py-2 text-right font-medium">{formatINR(line.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
