import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalInvoice } from "@/routes/portal/types";

const MODES = ["cash", "upi", "bank", "card"];

export function PortalInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("upi");
  const [referenceNote, setReferenceNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-invoice", invoiceId],
    queryFn: () => apiFetch<PortalInvoice>(`/portal/invoices/${invoiceId}`),
  });

  const submitPayment = useMutation({
    mutationFn: () =>
      apiFetch("/portal/payments", {
        method: "POST",
        body: { amount, mode, reference_note: referenceNote, invoice_id: invoiceId },
      }),
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!invoice) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{invoice.number}</h1>
        <Badge variant={invoice.status === "cancelled" ? "destructive" : "outline"} className="mt-1">{invoice.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">Rate</th><th className="pb-2">Taxable value</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2">{formatINR(line.taxable_value)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end text-sm">
            <div className="w-48 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(invoice.tax_total)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(invoice.total)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Report a payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            This tells your supplier you've paid -- it isn't a payment gateway. They'll verify and reconcile it against this invoice.
          </p>
          {submitted ? (
            <p className="text-sm text-success">Thanks -- your payment has been recorded and your supplier has been notified.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mode">Mode</Label>
                  <select
                    id="mode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference / UTR number</Label>
                <Input id="reference" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="e.g. UPI ref or cheque number" />
              </div>
              {submitPayment.isError && (
                <p className="text-sm text-destructive">{submitPayment.error instanceof ApiError ? submitPayment.error.message : "Could not submit."}</p>
              )}
              <Button onClick={() => submitPayment.mutate()} disabled={!amount || submitPayment.isPending}>
                {submitPayment.isPending ? "Submitting..." : "Submit payment"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
