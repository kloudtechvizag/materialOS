import { useQuery } from "@tanstack/react-query";
import { FileMinus, FilePlus } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface SalesReturn {
  id: string;
  number: string;
  invoice_id: string;
  return_date: string;
  reason: string | null;
  total: string;
}

interface PurchaseReturn {
  id: string;
  number: string;
  purchase_bill_id: string;
  return_date: string;
  reason: string | null;
  total: string;
}

/** Credit notes (SalesReturn, goods a customer sent back) and debit
 * notes (PurchaseReturn, goods we sent back to a supplier) side by
 * side -- two real, independently-numbered, journal-reversing
 * documents (services/sales_return.py, services/purchase_return.py),
 * not a fabricated combined view. Creating one still happens against
 * the originating invoice/purchase bill (POST /sales-returns,
 * POST /purchase-returns) -- this page is the read side. */
export function CreditDebitNotesPage() {
  const { data: creditNotes, isLoading: loadingCredit, error: creditError } = useQuery({
    queryKey: ["sales-returns"], queryFn: () => apiFetch<SalesReturn[]>("/sales-returns"),
  });
  const { data: debitNotes, isLoading: loadingDebit, error: debitError } = useQuery({
    queryKey: ["purchase-returns"], queryFn: () => apiFetch<PurchaseReturn[]>("/purchase-returns"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Credit &amp; debit notes</h1>
        <p className="text-sm text-muted-foreground">
          Credit notes reduce what a customer owes; debit notes reduce what you owe a supplier. Both reverse stock and the original document's journal entry.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileMinus className="h-4 w-4" /> Credit notes (customer returns)
          </h2>
          {loadingCredit && <Skeleton className="h-32" />}
          {creditError && <ErrorState error={creditError} />}
          {creditNotes && creditNotes.length === 0 && (
            <EmptyState icon={FileMinus} title="No credit notes yet" description="Recorded against a posted invoice when a customer returns goods." />
          )}
          {creditNotes && creditNotes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Number</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.map((n) => (
                    <tr key={n.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link to={`/invoices/${n.invoice_id}`} className="font-medium text-primary hover:underline">{n.number}</Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{n.return_date}</td>
                      <td className="px-4 py-2">{n.reason ?? <span className="text-muted-foreground">--</span>}</td>
                      <td className="px-4 py-2 font-medium">{formatINR(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FilePlus className="h-4 w-4" /> Debit notes (supplier returns)
          </h2>
          {loadingDebit && <Skeleton className="h-32" />}
          {debitError && <ErrorState error={debitError} />}
          {debitNotes && debitNotes.length === 0 && (
            <EmptyState icon={FilePlus} title="No debit notes yet" description="Recorded against a posted purchase bill when you return goods to a supplier." />
          )}
          {debitNotes && debitNotes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Number</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {debitNotes.map((n) => (
                    <tr key={n.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link to={`/purchase-bills/${n.purchase_bill_id}`} className="font-medium text-primary hover:underline">{n.number}</Link>
                        <Badge variant="warning" className="ml-2">Debit note</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{n.return_date}</td>
                      <td className="px-4 py-2">{n.reason ?? <span className="text-muted-foreground">--</span>}</td>
                      <td className="px-4 py-2 font-medium">{formatINR(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
