import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CheckCircle2, Image, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface PrintJob {
  id: string;
  number: string;
  job_type: string;
  specification: Record<string, string>;
  quantity: string;
  status: string;
  priority: string;
  quoted_price: string;
  material_cost: string;
  printing_cost: string;
  finishing_cost: string;
  labor_cost: string;
  wastage_cost: string;
  invoice_id: string | null;
}

interface Artwork {
  id: string;
  version_number: number;
  file_name: string;
  status: string;
  comments: string | null;
}

interface Profitability {
  revenue: string;
  total_cost: string;
  gross_profit: string;
  margin_pct: string;
}

const BOARD_STATUSES = [
  "draft", "quoted", "approved", "artwork_pending", "prepress", "ready_to_print",
  "printing", "finishing", "qc", "rework", "packing", "ready_for_pickup", "dispatched",
];

export function PrintJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [costs, setCosts] = useState<Record<string, string> | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ["print-job", jobId],
    queryFn: () => apiFetch<PrintJob>(`/print-jobs/${jobId}`),
  });
  const { data: artwork = [] } = useQuery({
    queryKey: ["print-job-artwork", jobId],
    queryFn: () => apiFetch<Artwork[]>(`/print-jobs/${jobId}/artwork`),
  });
  const { data: profitability } = useQuery({
    queryKey: ["print-job-profitability", jobId],
    queryFn: () => apiFetch<Profitability>(`/print-jobs/${jobId}/profitability`),
    enabled: !!job,
  });

  const invalidateJob = () => {
    queryClient.invalidateQueries({ queryKey: ["print-job", jobId] });
    queryClient.invalidateQueries({ queryKey: ["print-job-artwork", jobId] });
    queryClient.invalidateQueries({ queryKey: ["print-job-profitability", jobId] });
    queryClient.invalidateQueries({ queryKey: ["printing-board"] });
    queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: string) => apiFetch(`/print-jobs/${jobId}/status`, { method: "PATCH", body: { status } }),
    onSuccess: invalidateJob,
  });

  const uploadArtwork = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch(`/print-jobs/${jobId}/artwork`, { method: "POST", body, isFormData: true });
    },
    onSuccess: invalidateJob,
  });

  const approveArtwork = useMutation({
    mutationFn: (artworkId: string) => apiFetch(`/print-jobs/${jobId}/artwork/${artworkId}/approve`, { method: "POST" }),
    onSuccess: invalidateJob,
  });

  const saveCosts = useMutation({
    mutationFn: () =>
      apiFetch(`/print-jobs/${jobId}`, {
        method: "PATCH",
        body: {
          material_cost: Number(costs?.material_cost ?? job?.material_cost),
          printing_cost: Number(costs?.printing_cost ?? job?.printing_cost),
          finishing_cost: Number(costs?.finishing_cost ?? job?.finishing_cost),
          labor_cost: Number(costs?.labor_cost ?? job?.labor_cost),
          wastage_cost: Number(costs?.wastage_cost ?? job?.wastage_cost),
        },
      }),
    onSuccess: () => {
      invalidateJob();
      setCosts(null);
    },
  });

  const completeJob = useMutation({
    mutationFn: () =>
      apiFetch(`/print-jobs/${jobId}/complete`, {
        method: "POST",
        body: paymentAmount ? { payment_amount: Number(paymentAmount), payment_mode: "cash" } : {},
      }),
    onSuccess: invalidateJob,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!job) return null;

  const latestArtwork = artwork[0];
  const artworkApproved = latestArtwork?.status === "approved";
  const costFields = costs ?? {
    material_cost: job.material_cost, printing_cost: job.printing_cost, finishing_cost: job.finishing_cost,
    labor_cost: job.labor_cost, wastage_cost: job.wastage_cost,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{job.number}</h1>
          <p className="text-sm text-muted-foreground">{job.job_type} &middot; Qty {job.quantity}</p>
        </div>
        <Badge variant="outline" className="capitalize">{job.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Production stage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {BOARD_STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={job.status === s ? "default" : "outline"}
                  onClick={() => setStatus.mutate(s)}
                  disabled={setStatus.isPending}
                  className="capitalize"
                >
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
            {!artworkApproved && <p className="text-xs text-amber-600">Production stages beyond "Ready to print" are blocked until the latest artwork is approved.</p>}
            {setStatus.isError && <ErrorState error={setStatus.error} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Artwork</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadArtwork.mutate(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadArtwork.isPending}>
              <Upload className="h-4 w-4" /> {uploadArtwork.isPending ? "Uploading..." : "Upload new version"}
            </Button>
            <div className="space-y-2">
              {artwork.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <span>v{a.version_number} &middot; {a.file_name}</span>
                  </div>
                  {a.status === "approved" ? (
                    <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => approveArtwork.mutate(a.id)} disabled={approveArtwork.isPending}>
                      Approve
                    </Button>
                  )}
                </div>
              ))}
              {artwork.length === 0 && <p className="text-sm text-muted-foreground">No artwork uploaded yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Job costing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(["material_cost", "printing_cost", "finishing_cost", "labor_cost", "wastage_cost"] as const).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs capitalize">{field.replace(/_/g, " ")}</Label>
                  <Input
                    type="number"
                    value={costFields[field]}
                    onChange={(e) => setCosts({ ...costFields, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {costs && (
              <Button size="sm" onClick={() => saveCosts.mutate()} disabled={saveCosts.isPending}>
                {saveCosts.isPending ? "Saving..." : "Save costs"}
              </Button>
            )}
            {profitability && (
              <div className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span>{formatINR(profitability.revenue)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span>{formatINR(profitability.total_cost)}</span></div>
                <div className="flex justify-between font-semibold"><span>Gross profit</span><span>{formatINR(profitability.gross_profit)} ({Number(profitability.margin_pct).toFixed(1)}%)</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Delivery &amp; invoice</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Quoted price: <span className="font-medium">{formatINR(job.quoted_price)}</span></p>
            {job.invoice_id ? (
              <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Invoiced</Badge>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Payment received now (optional)</Label>
                  <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" />
                </div>
                {completeJob.isError && <ErrorState error={completeJob.error} />}
                <Button onClick={() => completeJob.mutate()} disabled={completeJob.isPending}>
                  {completeJob.isPending ? "Completing..." : "Complete & invoice"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
