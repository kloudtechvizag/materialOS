import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { PortalQuotation } from "@/routes/portal/types";

export function PortalQuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const { data: quotation, isLoading, error, refetch } = useQuery({
    queryKey: ["portal-quotation", quotationId],
    queryFn: () => apiFetch<PortalQuotation>(`/portal/quotations/${quotationId}`),
  });

  const approve = useMutation({
    mutationFn: () => apiFetch(`/portal/quotations/${quotationId}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-quotation", quotationId] }),
  });
  const reject = useMutation({
    mutationFn: () => apiFetch(`/portal/quotations/${quotationId}/reject`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-quotation", quotationId] }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !quotationId) return;
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("quotation_id", quotationId);
    try {
      await apiFetch("/portal/documents", { method: "POST", body: form, isFormData: true });
      setUploadedName(file.name);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!quotation) return null;

  const canDecide = quotation.status === "sent";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{quotation.number}</h1>
          <Badge variant={quotation.status === "approved" || quotation.status === "converted" ? "success" : quotation.status === "rejected" ? "destructive" : "outline"} className="mt-1">
            {quotation.status}
          </Badge>
        </div>
        {canDecide && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending}>Reject</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>
          </div>
        )}
      </div>

      {(approve.isError || reject.isError) && <ErrorState error={(approve.error ?? reject.error) as Error} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Qty</th><th className="pb-2">Rate</th><th className="pb-2">Subtotal</th><th className="pb-2">Tax</th><th className="pb-2">Total</th></tr>
            </thead>
            <tbody>
              {quotation.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{line.qty} {line.uom}</td>
                  <td className="py-2">{formatINR(line.rate)}</td>
                  <td className="py-2">{formatINR(line.line_subtotal)}</td>
                  <td className="py-2">{formatINR(line.line_tax)}</td>
                  <td className="py-2 font-medium">{formatINR(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end text-sm">
            <div className="w-48 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(quotation.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(quotation.tax_total)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(quotation.total)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload your purchase order</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="text-sm" />
          {uploadedName && <p className="text-sm text-success">Uploaded {uploadedName}.</p>}
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
