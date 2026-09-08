import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptRenderer } from "@/components/receipts/ReceiptRenderer";
import { apiFetch } from "@/lib/api";
import type { ReceiptData, ReceiptSettings } from "@/lib/receipts";

const TOGGLE_FIELDS: { key: keyof ReceiptSettings; label: string; hint: string }[] = [
  { key: "show_logo", label: "Logo", hint: "Small MaterialOS mark at the top of every receipt." },
  { key: "show_customer_details", label: "Customer details", hint: "Name, phone, and GSTIN if on file." },
  { key: "show_gst_breakdown", label: "GST breakdown", hint: "CGST/SGST/IGST lines (subtotal and total always show)." },
  { key: "show_sku", label: "SKU", hint: "Item code under each line item." },
  { key: "show_cashier", label: "Cashier name", hint: "Who rang up the sale, from the audit trail." },
  { key: "show_qr_code", label: "UPI QR code", hint: "Requires a UPI ID below." },
];

const SAMPLE_DATA: ReceiptData = {
  document_type: "pos_receipt", document_number: "INV-2026-27-000123", document_date: "2026-09-08", document_time: "14:32",
  company_name: "Your Company", company_legal_name: "Your Company Pvt Ltd", company_gstin: "37AASCS1234F1Z5",
  company_phone: "9876543210", company_email: "billing@example.com", company_address: "Main Road, Vijayawada, Andhra Pradesh",
  branch_name: "Main Branch", branch_gstin: null, cashier_name: "Owner",
  customer_id: null, customer_name: "Walk-in Customer", customer_phone: "9911223344", customer_gstin: null, place_of_supply: "Andhra Pradesh",
  items: [
    { name: "Sample Product A", sku: "SKU-001", qty: "2", uom: "PCS", rate: "150.00", discount: "0", tax_rate: "18", line_total: "354.00" },
    { name: "Sample Product B", sku: "SKU-002", qty: "1", uom: "PCS", rate: "500.00", discount: "0", tax_rate: "18", line_total: "590.00" },
  ],
  subtotal: "800.00", total_discount: "0", cgst_amount: "72.00", sgst_amount: "72.00", igst_amount: "0", round_off: "0", grand_total: "944.00",
  payment_method: "Cash", amount_paid: "1000.00", balance_due: null, change_due: "56.00", customer_credit_balance: null,
  notes: null, settings: { show_logo: true, show_customer_details: true, show_gst_breakdown: true, show_sku: true, show_cashier: true, show_qr_code: false, footer_message: null, terms_and_conditions: null, return_policy: null, upi_id: null, social_contact_info: null, default_paper_width_mm: 80 },
};

/** Admin config for the receipt template engine (ADR-016) -- every
 * toggle here changes what every printed document shows, across every
 * module (POS, invoices, quotations, ...), because they all render
 * through the same ReceiptRenderer fed by these same settings. */
export function ReceiptSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReceiptSettings | null>(null);
  const [previewWidth, setPreviewWidth] = useState(80);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["receipt-settings"],
    queryFn: () => apiFetch<ReceiptSettings>("/receipt-settings"),
  });

  useEffect(() => {
    if (data) {
      setForm(data);
      setPreviewWidth(data.default_paper_width_mm);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch<ReceiptSettings>("/receipt-settings", { method: "PUT", body: form }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["receipt-settings"], saved);
      setForm(saved);
    },
  });

  if (isLoading || !form) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const previewData: ReceiptData = { ...SAMPLE_DATA, settings: form };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Printer className="h-5 w-5" /> Receipt settings</h1>
        <p className="text-sm text-muted-foreground">Controls every printed document across POS, invoices, quotations, and more -- one shared template, one place to configure it.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">What shows on the receipt</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {TOGGLE_FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(form[key])}
                    onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.checked } : f))}
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Paper &amp; payments</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Default paper width</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.default_paper_width_mm}
                  onChange={(e) => setForm((f) => (f ? { ...f, default_paper_width_mm: Number(e.target.value) } : f))}
                >
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>UPI ID (for QR)</Label>
                <Input value={form.upi_id ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, upi_id: e.target.value || null } : f))} placeholder="yourshop@okhdfcbank" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Footer</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Footer message</Label>
                <Input value={form.footer_message ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, footer_message: e.target.value || null } : f))} placeholder="Thank you for your business!" />
              </div>
              <div className="space-y-1.5">
                <Label>Terms &amp; conditions</Label>
                <Input value={form.terms_and_conditions ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, terms_and_conditions: e.target.value || null } : f))} />
              </div>
              <div className="space-y-1.5">
                <Label>Return policy</Label>
                <Input value={form.return_policy ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, return_policy: e.target.value || null } : f))} />
              </div>
              <div className="space-y-1.5">
                <Label>Social / contact</Label>
                <Input value={form.social_contact_info ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, social_contact_info: e.target.value || null } : f))} placeholder="www.example.com · @yourshop" />
              </div>
            </CardContent>
          </Card>

          {save.isError && <ErrorState error={save.error} />}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setPreviewWidth(58)} className={`rounded-md border px-3 py-1 text-xs ${previewWidth === 58 ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>58mm</button>
            <button onClick={() => setPreviewWidth(80)} className={`rounded-md border px-3 py-1 text-xs ${previewWidth === 80 ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>80mm</button>
          </div>
          <div className="flex justify-center rounded-md border border-dashed border-border bg-muted/30 p-4">
            <ReceiptRenderer data={previewData} paperWidthMm={previewWidth} />
          </div>
        </div>
      </div>
    </div>
  );
}
