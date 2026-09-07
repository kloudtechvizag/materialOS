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
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface EInvoice { id: string; irn: string; ack_number: string; status: string; }
interface EWayBill { id: string; ewb_number: string; valid_until: string; status: string; }

function useOptional<T>(key: unknown[], fn: () => Promise<T>) {
  return useQuery<T | null>({
    queryKey: key,
    queryFn: async () => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

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

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [distanceKm, setDistanceKm] = useState("");

  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => apiFetch<Invoice>(`/invoices/${invoiceId}`),
  });

  const eInvoice = useOptional(["e-invoice", invoiceId], () => apiFetch<EInvoice>(`/invoices/${invoiceId}/e-invoice`));
  const eWayBill = useOptional(["e-way-bill", invoiceId], () => apiFetch<EWayBill>(`/invoices/${invoiceId}/e-way-bill`));

  const generateEInvoice = useMutation({
    mutationFn: () => apiFetch<EInvoice>(`/invoices/${invoiceId}/e-invoice`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["e-invoice", invoiceId] }),
  });
  const cancelEInvoice = useMutation({
    mutationFn: () => apiFetch(`/e-invoices/${eInvoice.data?.id}/cancel`, { method: "POST", body: { reason: "Cancelled from MaterialOS" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["e-invoice", invoiceId] }),
  });
  const generateEwayBill = useMutation({
    mutationFn: () =>
      apiFetch<EWayBill>(`/invoices/${invoiceId}/e-way-bill`, {
        method: "POST",
        body: { vehicle_number: vehicleNumber, distance_km: Number(distanceKm) },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["e-way-bill", invoiceId] }),
  });
  const cancelEwayBill = useMutation({
    mutationFn: () => apiFetch(`/e-way-bills/${eWayBill.data?.id}/cancel`, { method: "POST", body: { reason: "Cancelled from MaterialOS" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["e-way-bill", invoiceId] }),
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
        <CardHeader><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">E-invoice (IRN)</p>
              {eInvoice.data ? (
                <p className="text-xs text-muted-foreground">IRN {eInvoice.data.irn.slice(0, 20)}... · Ack {eInvoice.data.ack_number}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Not generated yet</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {eInvoice.data && <Badge variant={eInvoice.data.status === "generated" ? "success" : "destructive"}>{eInvoice.data.status}</Badge>}
              {!eInvoice.data && (
                <Button size="sm" variant="outline" onClick={() => generateEInvoice.mutate()} disabled={generateEInvoice.isPending}>
                  {generateEInvoice.isPending ? "Generating..." : "Generate IRN"}
                </Button>
              )}
              {eInvoice.data?.status === "generated" && (
                <Button size="sm" variant="outline" onClick={() => cancelEInvoice.mutate()} disabled={cancelEInvoice.isPending}>Cancel</Button>
              )}
            </div>
          </div>
          {generateEInvoice.isError && <ErrorState error={generateEInvoice.error} />}

          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">E-way bill</p>
                {eWayBill.data ? (
                  <p className="text-xs text-muted-foreground">EWB {eWayBill.data.ewb_number} · valid until {new Date(eWayBill.data.valid_until).toLocaleDateString()}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not generated yet</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {eWayBill.data && <Badge variant={eWayBill.data.status === "active" ? "success" : "destructive"}>{eWayBill.data.status}</Badge>}
                {eWayBill.data?.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => cancelEwayBill.mutate()} disabled={cancelEwayBill.isPending}>Cancel</Button>
                )}
              </div>
            </div>
            {!eWayBill.data && (
              <div className="mt-3 flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vehicle number</Label>
                  <Input className="h-8 w-32" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="AP31AB1234" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Distance (km)</Label>
                  <Input className="h-8 w-24" type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" onClick={() => generateEwayBill.mutate()} disabled={!vehicleNumber || !distanceKm || generateEwayBill.isPending}>
                  {generateEwayBill.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            )}
            {generateEwayBill.isError && <ErrorState error={generateEwayBill.error} />}
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
