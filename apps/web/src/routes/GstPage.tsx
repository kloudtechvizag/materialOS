import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Gstr1 {
  b2b: { customer_gstin: string; customer_name: string; invoice_number: string; invoice_date: string; taxable_value: string; cgst: string; sgst: string; igst: string; total: string }[];
  b2cs: { place_of_supply: string; tax_rate: string; taxable_value: string; cgst: string; sgst: string; igst: string }[];
  cdnr: { customer_gstin: string; customer_name: string; note_number: string; note_date: string; taxable_value: string; tax_amount: string }[];
  hsn_summary: { hsn_code: string; uom: string; total_qty: string; taxable_value: string; tax_amount: string }[];
}

interface Gstr3b {
  outward_taxable_value: string; outward_cgst: string; outward_sgst: string; outward_igst: string;
  input_tax_credit_cgst: string; input_tax_credit_sgst: string; input_tax_credit_igst: string; net_tax_payable: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function GstPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const gstr1 = useQuery({ queryKey: ["gstr1", month, year], queryFn: () => apiFetch<Gstr1>(`/gst/gstr1?month=${month}&year=${year}`) });
  const gstr3b = useQuery({ queryKey: ["gstr3b", month, year], queryFn: () => apiFetch<Gstr3b>(`/gst/gstr3b?month=${month}&year=${year}`) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">GST filing extracts</h1>
          <p className="text-sm text-muted-foreground">Data extracts shaped like the GST portal's own return sections -- not e-filing itself.</p>
        </div>
        <div className="flex gap-2">
          <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">GSTR-3B summary</CardTitle></CardHeader>
        <CardContent>
          {gstr3b.isLoading && <Skeleton className="h-24" />}
          {gstr3b.error && <ErrorState error={gstr3b.error} onRetry={() => gstr3b.refetch()} />}
          {gstr3b.data && (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><p className="text-muted-foreground">Outward taxable value</p><p className="font-semibold">{formatINR(gstr3b.data.outward_taxable_value)}</p></div>
              <div><p className="text-muted-foreground">Output tax (C+S+I GST)</p><p className="font-semibold">{formatINR((Number(gstr3b.data.outward_cgst) + Number(gstr3b.data.outward_sgst) + Number(gstr3b.data.outward_igst)).toString())}</p></div>
              <div><p className="text-muted-foreground">Input tax credit</p><p className="font-semibold">{formatINR((Number(gstr3b.data.input_tax_credit_cgst) + Number(gstr3b.data.input_tax_credit_sgst) + Number(gstr3b.data.input_tax_credit_igst)).toString())}</p></div>
              <div><p className="text-muted-foreground">Net tax payable</p><p className="font-semibold">{formatINR(gstr3b.data.net_tax_payable)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">B2B invoices ({gstr1.data?.b2b.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {gstr1.isLoading && <Skeleton className="h-24" />}
          {gstr1.data && (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="pb-2">Invoice</th><th className="pb-2">Customer</th><th className="pb-2">GSTIN</th><th className="pb-2 text-right">Taxable</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {gstr1.data.b2b.map((row) => (
                  <tr key={row.invoice_number} className="border-t border-border">
                    <td className="py-2">{row.invoice_number}</td>
                    <td className="py-2">{row.customer_name}</td>
                    <td className="py-2 text-muted-foreground">{row.customer_gstin}</td>
                    <td className="py-2 text-right">{formatINR(row.taxable_value)}</td>
                    <td className="py-2 text-right font-medium">{formatINR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">B2CS summary (unregistered customers, by rate)</CardTitle></CardHeader>
        <CardContent>
          {gstr1.data && (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="pb-2">Place of supply</th><th className="pb-2">Rate</th><th className="pb-2 text-right">Taxable</th><th className="pb-2 text-right">Tax</th></tr></thead>
              <tbody>
                {gstr1.data.b2cs.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">{row.place_of_supply}</td>
                    <td className="py-2">{row.tax_rate}%</td>
                    <td className="py-2 text-right">{formatINR(row.taxable_value)}</td>
                    <td className="py-2 text-right">{formatINR((Number(row.cgst) + Number(row.sgst) + Number(row.igst)).toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">HSN summary</CardTitle></CardHeader>
        <CardContent>
          {gstr1.data && (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="pb-2">HSN</th><th className="pb-2">UOM</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Taxable</th><th className="pb-2 text-right">Tax</th></tr></thead>
              <tbody>
                {gstr1.data.hsn_summary.map((row) => (
                  <tr key={row.hsn_code} className="border-t border-border">
                    <td className="py-2">{row.hsn_code}</td>
                    <td className="py-2 text-muted-foreground">{row.uom}</td>
                    <td className="py-2 text-right">{row.total_qty}</td>
                    <td className="py-2 text-right">{formatINR(row.taxable_value)}</td>
                    <td className="py-2 text-right">{formatINR(row.tax_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {gstr1.data && gstr1.data.cdnr.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Credit notes (CDNR)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="pb-2">Note</th><th className="pb-2">Customer</th><th className="pb-2 text-right">Taxable</th><th className="pb-2 text-right">Tax</th></tr></thead>
              <tbody>
                {gstr1.data.cdnr.map((row) => (
                  <tr key={row.note_number} className="border-t border-border">
                    <td className="py-2">{row.note_number}</td>
                    <td className="py-2">{row.customer_name}</td>
                    <td className="py-2 text-right">{formatINR(row.taxable_value)}</td>
                    <td className="py-2 text-right">{formatINR(row.tax_amount)}</td>
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
