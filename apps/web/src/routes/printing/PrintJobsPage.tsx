import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
  quantity: string;
  status: string;
  priority: string;
  due_date: string | null;
  quoted_price: string;
}

interface Customer {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", quoted: "Quoted", approved: "Approved", artwork_pending: "Artwork pending",
  prepress: "Prepress", ready_to_print: "Ready to print", printing: "Printing", finishing: "Finishing",
  qc: "Quality check", rework: "Rework", packing: "Packing", ready_for_pickup: "Ready for pickup",
  dispatched: "Dispatched", invoiced: "Invoiced", cancelled: "Cancelled",
};

export function PrintJobsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: "", job_type: "", quantity: "1", quoted_price: "0", gst_rate: "18", due_date: "", priority: "normal",
  });

  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: () => apiFetch<PrintJob[]>("/print-jobs"),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  const createJob = useMutation({
    mutationFn: () =>
      apiFetch<PrintJob>("/print-jobs", {
        method: "POST",
        body: {
          customer_id: form.customer_id,
          job_type: form.job_type,
          quantity: Number(form.quantity),
          quoted_price: Number(form.quoted_price),
          gst_rate: Number(form.gst_rate),
          due_date: form.due_date || null,
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["printing-board"] });
      setShowForm(false);
      setForm({ customer_id: "", job_type: "", quantity: "1", quoted_price: "0", gst_rate: "18", due_date: "", priority: "normal" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Print jobs</h1>
          <p className="text-sm text-muted-foreground">Every job, quoted or in production.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New job"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New print job</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Job type</Label>
                <Input value={form.job_type} onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))} placeholder="Business Cards" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quoted price</Label>
                <Input type="number" value={form.quoted_price} onChange={(e) => setForm((f) => ({ ...f, quoted_price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input type="number" value={form.gst_rate} onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="express">Express</option>
                </select>
              </div>
            </div>
            {createJob.isError && <ErrorState error={createJob.error} />}
            <Button onClick={() => createJob.mutate()} disabled={!form.customer_id || !form.job_type || createJob.isPending}>
              {createJob.isPending ? "Saving..." : "Create job"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {jobs && jobs.length === 0 && !showForm && (
        <EmptyState icon={Printer} title="No print jobs yet" description="Create your first job to start the production workflow." actionLabel="New job" onAction={() => setShowForm(true)} />
      )}

      {jobs && jobs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="px-4 py-2"><Link to={`/print-jobs/${job.id}`} className="font-medium text-primary hover:underline">{job.number}</Link></td>
                  <td className="px-4 py-2">{job.job_type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{job.quantity}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{STATUS_LABELS[job.status] ?? job.status}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground capitalize">{job.priority}</td>
                  <td className="px-4 py-2 text-muted-foreground">{job.due_date ?? "-"}</td>
                  <td className="px-4 py-2">{formatINR(job.quoted_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
