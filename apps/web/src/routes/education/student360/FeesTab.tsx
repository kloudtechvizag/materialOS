import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IndianRupee } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import type { FeeInvoiceSummary } from "./types";

export function FeesTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: feeInvoices, isLoading, error } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: () => apiFetch<FeeInvoiceSummary[]>(`/students/${studentId}/fees`),
  });

  const recordPayment = useMutation({
    mutationFn: (invoice: FeeInvoiceSummary) =>
      apiFetch("/receipts", {
        method: "POST",
        body: { customer_id: invoice.customer_id, amount: paymentAmount, mode: "cash", reference_note: `Fee payment for ${invoice.invoice_number}`, invoice_id: invoice.invoice_id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees", studentId] });
      setPayingInvoiceId(null);
      setPaymentAmount("");
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <p className="text-sm text-destructive">Could not load fees.</p>;
  if (!feeInvoices || feeInvoices.length === 0) {
    return <EmptyState icon={IndianRupee} title="No fee invoices yet" description="Once a fee is billed to this student, invoices and balances will appear here." />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const totalAssigned = feeInvoices.reduce((s, i) => s + Number(i.total), 0);
  const totalOutstanding = feeInvoices.reduce((s, i) => s + Number(i.outstanding), 0);
  const totalPaid = totalAssigned - totalOutstanding;
  const nextDue = feeInvoices.filter((i) => Number(i.outstanding) > 0 && i.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Assigned</p>
          <p className="text-xl font-semibold">₹{totalAssigned.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-xl font-semibold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-semibold text-destructive">₹{totalOutstanding.toLocaleString("en-IN")}</p>
        </div>
      </div>
      {nextDue && <p className="text-sm text-muted-foreground">Next due: <span className="font-medium text-foreground">₹{Number(nextDue.outstanding).toLocaleString("en-IN")}</span> on {nextDue.due_date}</p>}

      <div className="space-y-2">
        {feeInvoices.map((inv) => {
          const isOverdue = Number(inv.outstanding) > 0 && !!inv.due_date && inv.due_date < today;
          return (
            <div key={inv.id} className="space-y-1.5 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoice_date} · Total ₹{Number(inv.total).toLocaleString("en-IN")}{inv.due_date ? ` · Due ${inv.due_date}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={Number(inv.outstanding) <= 0 ? "success" : isOverdue ? "destructive" : "outline"}>
                    {Number(inv.outstanding) <= 0 ? "Paid" : isOverdue ? `₹${Number(inv.outstanding).toLocaleString("en-IN")} overdue` : `₹${Number(inv.outstanding).toLocaleString("en-IN")} due`}
                  </Badge>
                  {Number(inv.outstanding) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => { setPayingInvoiceId(inv.id); setPaymentAmount(inv.outstanding); }}>
                      Collect payment
                    </Button>
                  )}
                </div>
              </div>
              {payingInvoiceId === inv.id && (
                <div className="flex items-center gap-2 pt-1">
                  <Input type="number" className="h-8 w-28" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <Button size="sm" className="h-8" onClick={() => recordPayment.mutate(inv)} disabled={!paymentAmount || recordPayment.isPending}>
                    {recordPayment.isPending ? "Saving..." : "Confirm"}
                  </Button>
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPayingInvoiceId(null)}>Cancel</button>
                </div>
              )}
              {recordPayment.error instanceof ApiError && payingInvoiceId === inv.id && <p className="text-xs text-destructive">{recordPayment.error.message}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
