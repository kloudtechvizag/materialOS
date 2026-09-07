import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Company {
  id: string;
  name: string;
  gstin: string | null;
  state: string | null;
  e_invoice_enabled: boolean;
  e_way_bill_enabled: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: companies, isLoading, error, refetch } = useQuery({
    queryKey: ["companies"], queryFn: () => apiFetch<Company[]>("/companies"),
  });
  const company = companies?.[0];

  const updateCompliance = useMutation({
    mutationFn: (patch: Partial<Pick<Company, "e_invoice_enabled" | "e_way_bill_enabled">>) =>
      apiFetch(`/companies/${company?.id}/compliance`, { method: "PATCH", body: patch }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });

  async function downloadTallyExport() {
    setExportError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:58000/api/v1";
      const res = await fetch(`${base}/tally-export?from_date=${fromDate}&to_date=${toDate}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `materialos-tally-export-${fromDate}-${toDate}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Could not export. Try again.");
    }
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!company) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Company settings</h1>
        <p className="text-sm text-muted-foreground">{company.name} · {company.gstin ?? "No GSTIN on file"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">GST compliance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">E-invoicing (IRN)</p>
              <p className="text-xs text-muted-foreground">Mandatory once AATO crosses ₹5 crore in any FY (D2) -- turn on only once that's actually true.</p>
            </div>
            <input
              type="checkbox"
              checked={company.e_invoice_enabled}
              onChange={(e) => updateCompliance.mutate({ e_invoice_enabled: e.target.checked })}
              className="h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">E-way bill</p>
              <p className="text-xs text-muted-foreground">Required above the interstate/intrastate value thresholds (D3).</p>
            </div>
            <input
              type="checkbox"
              checked={company.e_way_bill_enabled}
              onChange={(e) => updateCompliance.mutate({ e_way_bill_enabled: e.target.checked })}
              className="h-5 w-5"
            />
          </label>
          {updateCompliance.isError && <ErrorState error={updateCompliance.error} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Export to Tally</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Tally keeps your books -- export a period's vouchers for your CA to import.</p>
          <div className="flex items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
          {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          <Button variant="outline" onClick={downloadTallyExport}>
            <Download className="h-4 w-4" /> Download Tally XML
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
