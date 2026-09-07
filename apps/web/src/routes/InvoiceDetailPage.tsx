import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface InvoiceItem {
  id: string;
  qty: string;
  uom: string;
  rate: string;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  line_total: string;
}

interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  invoice_date: string;
  place_of_supply_state: string;
  subtotal: string;
  tax_total: string;
  round_off: string;
  total: string;
  items: InvoiceItem[];
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("bank");

  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => apiFetch<Invoice>(`/invoices/${invoiceId}`),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      apiFetch("/receipts", {
        method: "POST",
        body: { customer_id: invoice?.customer_id, amount: Number(amount), mode, invoice_id: invoiceId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      setAmount("");
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!invoice) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{invoice.number}</h1>
        <p className="text-sm text-muted-foreground">{invoice.invoice_date} · Place of supply: {invoice.place_of_supply_state}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">Rate</th><th className="pb-2">Taxable</th><th className="pb-2">CGST</th><th className="pb-2">SGST</th><th className="pb-2">IGST</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2">{formatINR(line.taxable_value)}</td>
                  <td className="py-2 text-muted-foreground">{formatINR(line.cgst_amount)}</td>
                  <td className="py-2 text-muted-foreground">{formatINR(line.sgst_amount)}</td>
                  <td className="py-2 text-muted-foreground">{formatINR(line.igst_amount)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <div className="w-48 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(invoice.tax_total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Round off</span><span>{formatINR(invoice.round_off)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatINR(invoice.total)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Record payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          {recordPayment.isError && <ErrorState error={recordPayment.error} />}
          {recordPayment.isSuccess && <Badge variant="success">Payment recorded</Badge>}
          <Button onClick={() => recordPayment.mutate()} disabled={!amount || recordPayment.isPending}>
            {recordPayment.isPending ? "Recording..." : "Record payment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
