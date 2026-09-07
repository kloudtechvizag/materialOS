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

interface BillItem { id: string; qty: string; rate: string; taxable_value: string; cgst_amount: string; sgst_amount: string; igst_amount: string; line_total: string; }
interface PurchaseBill { id: string; number: string; supplier_id: string; bill_date: string; subtotal: string; tax_total: string; total: string; items: BillItem[]; }

export function PurchaseBillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("bank");

  const { data: bill, isLoading, error, refetch } = useQuery({
    queryKey: ["purchase-bill", billId],
    queryFn: () => apiFetch<PurchaseBill>(`/purchase-bills/${billId}`),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      apiFetch("/supplier-payments", {
        method: "POST",
        body: { supplier_id: bill?.supplier_id, amount: Number(amount), mode, purchase_bill_id: billId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-bill", billId] });
      setAmount("");
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!bill) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{bill.number}</h1>
        <p className="text-sm text-muted-foreground">{bill.bill_date}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">Rate</th><th className="pb-2">Taxable</th><th className="pb-2">CGST</th><th className="pb-2">SGST</th><th className="pb-2">IGST</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {bill.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty}</td>
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
          <div className="mt-4 flex justify-end text-lg font-semibold">Total: {formatINR(bill.total)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Record payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank transfer</option>
                <option value="upi">UPI</option>
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
