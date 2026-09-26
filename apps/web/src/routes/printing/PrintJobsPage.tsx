import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Download,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  BulkActionBar,
  DetailDrawer,
  MetricStrip,
  RowActions,
  SavedViews,
  SmartEmptyState,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatINRCompact } from "@/lib/format";

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
  draft: "Draft",
  quoted: "Quoted",
  approved: "Approved",
  artwork_pending: "Artwork Pending",
  prepress: "Prepress",
  ready_to_print: "Ready to Print",
  printing: "Printing",
  finishing: "Finishing",
  qc: "Quality Check",
  rework: "Rework",
  packing: "Packing",
  ready_for_pickup: "Ready for Pickup",
  dispatched: "Dispatched",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export function PrintJobsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    job_type: "",
    quantity: "1",
    quoted_price: "0",
    gst_rate: "18",
    due_date: "",
    priority: "normal",
  });

  // Filters & selection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedJob, setInspectedJob] = useState<PrintJob | null>(null);

  const {
    data: jobs,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: () => apiFetch<PrintJob[]>("/print-jobs"),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
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
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["printing-board"] });
      toast.success(`Print job ${newJob.number} created.`);
      setShowForm(false);
      setForm({
        customer_id: "",
        job_type: "",
        quantity: "1",
        quoted_price: "0",
        gst_rate: "18",
        due_date: "",
        priority: "normal",
      });
    },
  });

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      if (activeTab === "in_production") {
        const prodStatuses = ["prepress", "ready_to_print", "printing", "finishing", "qc", "packing"];
        if (!prodStatuses.includes(job.status)) return false;
      } else if (activeTab === "artwork_pending") {
        if (job.status !== "artwork_pending") return false;
      } else if (activeTab === "ready_to_print") {
        if (job.status !== "ready_to_print") return false;
      } else if (activeTab === "finishing_qc") {
        if (job.status !== "finishing" && job.status !== "qc" && job.status !== "rework") return false;
      } else if (activeTab === "dispatched") {
        if (job.status !== "dispatched" && job.status !== "ready_for_pickup" && job.status !== "invoiced")
          return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = job.number.toLowerCase().includes(q);
        const matchType = job.job_type.toLowerCase().includes(q);
        const matchPriority = job.priority.toLowerCase().includes(q);
        const matchStatus = (STATUS_LABELS[job.status] || job.status).toLowerCase().includes(q);
        if (!matchNumber && !matchType && !matchPriority && !matchStatus) return false;
      }

      return true;
    });
  }, [jobs, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!jobs) return [];
    const totalCount = jobs.length;
    const totalVal = jobs.reduce((sum, j) => sum + Number(j.quoted_price || 0), 0);
    const inProdCount = jobs.filter((j) =>
      ["prepress", "ready_to_print", "printing", "finishing", "qc", "packing"].includes(j.status)
    ).length;
    const urgentCount = jobs.filter((j) => j.priority === "urgent" || j.priority === "express").length;
    const artworkCount = jobs.filter((j) => j.status === "artwork_pending").length;

    return [
      {
        id: "total",
        label: "Total Print Jobs",
        value: totalCount,
        subvalue: formatINRCompact(totalVal),
        icon: Printer,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "in_prod",
        label: "On Press / In Production",
        value: inProdCount,
        subvalue: "Active machine jobs",
        icon: Layers,
        color: "emerald",
        onClick: () => setActiveTab("in_production"),
      },
      {
        id: "urgent",
        label: "Express & Urgent",
        value: urgentCount,
        subvalue: urgentCount > 0 ? "Expedited delivery" : "Normal pace",
        icon: Zap,
        color: urgentCount > 0 ? "rose" : "slate",
      },
      {
        id: "artwork",
        label: "Artwork Pending",
        value: artworkCount,
        subvalue: artworkCount > 0 ? "Awaiting customer proof" : "All cleared",
        icon: Clock,
        color: artworkCount > 0 ? "amber" : "slate",
        onClick: () => setActiveTab("artwork_pending"),
      },
    ];
  }, [jobs]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!jobs) return [];
    const itemsList: AttentionItem[] = [];

    const artworkPending = jobs.filter((j) => j.status === "artwork_pending");
    if (artworkPending.length > 0) {
      itemsList.push({
        id: "artwork-pending",
        title: `${artworkPending.length} Job${artworkPending.length > 1 ? "s" : ""} Awaiting Artwork Approval`,
        count: artworkPending.length,
        description: "Prepress cannot generate plates or digital proofs until customer signs off.",
        severity: "warning",
        actionLabel: "View Proofs Queue",
        onAction: () => setActiveTab("artwork_pending"),
      });
    }

    const reworks = jobs.filter((j) => j.status === "rework");
    if (reworks.length > 0) {
      itemsList.push({
        id: "rework",
        title: `${reworks.length} Job${reworks.length > 1 ? "s" : ""} Flagged for QC Rework`,
        count: reworks.length,
        description: "Color mismatch, registration error, or binding defect detected at finishing stage.",
        severity: "critical",
        actionLabel: "View QC Reworks",
        onAction: () => setActiveTab("finishing_qc"),
      });
    }

    return itemsList;
  }, [jobs]);

  // View tabs
  const viewTabs = useMemo(() => {
    if (!jobs) return [];
    const inProdCount = jobs.filter((j) =>
      ["prepress", "ready_to_print", "printing", "finishing", "qc", "packing"].includes(j.status)
    ).length;
    const artworkCount = jobs.filter((j) => j.status === "artwork_pending").length;
    const readyPrintCount = jobs.filter((j) => j.status === "ready_to_print").length;
    const qcCount = jobs.filter((j) => ["finishing", "qc", "rework"].includes(j.status)).length;
    const dispatchedCount = jobs.filter((j) =>
      ["dispatched", "ready_for_pickup", "invoiced"].includes(j.status)
    ).length;

    return [
      { id: "all", label: "All Jobs", count: jobs.length },
      { id: "in_production", label: "In Production", count: inProdCount },
      { id: "artwork_pending", label: "Artwork Pending", count: artworkCount },
      { id: "ready_to_print", label: "Ready to Print", count: readyPrintCount },
      { id: "finishing_qc", label: "Finishing & QC", count: qcCount },
      { id: "dispatched", label: "Dispatched", count: dispatchedCount },
    ];
  }, [jobs]);

  // Bulk actions
  const allSelected = filteredJobs.length > 0 && selectedIds.length === filteredJobs.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredJobs.map((j) => j.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleExportCsv = (rowsToExport = filteredJobs) => {
    downloadCsv("print-jobs", [
      ["Job Number", "Job Type", "Quantity", "Status", "Priority", "Due Date", "Quoted Price"],
      ...rowsToExport.map((j) => [
        j.number,
        j.job_type,
        j.quantity,
        STATUS_LABELS[j.status] || j.status,
        j.priority,
        j.due_date || "",
        j.quoted_price,
      ]),
    ]);
    toast.success(`Exported ${rowsToExport.length} print jobs to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Print Jobs &amp; Production"
        subtitle="Commercial printing pipeline: Quote → Prepress &amp; Artwork → Plate / Press → Finishing &amp; QC → Packing &amp; Dispatch."
        badge={jobs ? `${jobs.length} total` : undefined}
        primaryAction={{
          label: showForm ? "Cancel" : "New Print Job",
          icon: Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => handleExportCsv(),
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Metrics */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Press Room Alerts &amp; Exceptions"
        items={attentionItems}
        allClearMessage="Press room is running smoothly. No artwork blockers or flagged QC reworks."
      />

      {/* 4. New Job Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-base font-semibold">New Print Job Specification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Job Type / Product Description *</Label>
                <Input
                  value={form.job_type}
                  onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}
                  placeholder="e.g. 500 GSM Embossed Business Cards, Hardcover Catalog"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Print Quantity *</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quoted Price (₹) *</Label>
                <Input
                  type="number"
                  value={form.quoted_price}
                  onChange={(e) => setForm((f) => ({ ...f, quoted_price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>GST Rate (%)</Label>
                <Input
                  type="number"
                  value={form.gst_rate}
                  onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target Delivery Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Production Priority</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="express">Express (Overnight Turnaround)</option>
                </select>
              </div>
            </div>

            {createJob.isError && <ErrorState error={createJob.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createJob.mutate()}
                disabled={!form.customer_id || !form.job_type || createJob.isPending}
              >
                {createJob.isPending ? "Creating Job..." : "Create Print Job"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search job #, product type, status..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {jobs && jobs.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Printer}
          title="No print jobs recorded yet"
          description="Create your first job to schedule prepress artwork, allocate press machines, and track binding and delivery."
          primaryAction={{
            label: "Create First Print Job",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {jobs && jobs.length > 0 && filteredJobs.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No print jobs match your filters"
          description={`No jobs found in view "${activeTab}" with search "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filters",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 6. Action-First Data Grid */}
      {filteredJobs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Job #</th>
                <th className="px-4 py-3 font-medium">Product / Type</th>
                <th className="px-4 py-3 font-medium text-right">Quantity</th>
                <th className="px-4 py-3 font-medium">Stage / Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium text-right">Quoted Price</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredJobs.map((job) => {
                const isUrgent = job.priority === "urgent" || job.priority === "express";

                return (
                  <tr
                    key={job.id}
                    className={`group transition-colors hover:bg-accent/40 ${
                      isUrgent ? "bg-rose-50/10 dark:bg-rose-950/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.includes(job.id)}
                        onCheckedChange={() => toggleSelectOne(job.id)}
                        aria-label={`Select ${job.number}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/print-jobs/${job.id}`}
                        className="font-medium text-primary hover:underline font-mono"
                      >
                        {job.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{job.job_type}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {Number(job.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-medium">
                        {STATUS_LABELS[job.status] ?? job.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          job.priority === "express"
                            ? "destructive"
                            : job.priority === "urgent"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {job.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{job.due_date || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatINR(job.quoted_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        onView={() => setInspectedJob(job)}
                        onCopy={() => {
                          navigator.clipboard.writeText(job.number);
                          toast.success(`Copied ${job.number}`);
                        }}
                        viewLabel="Inspect Job"
                        detailHref={`/print-jobs/${job.id}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedRows = filteredJobs.filter((j) => selectedIds.includes(j.id));
              handleExportCsv(selectedRows);
            },
          },
        ]}
      />

      {/* 8. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedJob)}
        onOpenChange={(open) => !open && setInspectedJob(null)}
        title={inspectedJob ? `Job ${inspectedJob.number}` : ""}
        subtitle={inspectedJob ? `${inspectedJob.job_type} · Qty: ${inspectedJob.quantity}` : undefined}
        badge={
          inspectedJob ? (
            <Badge variant="outline">{STATUS_LABELS[inspectedJob.status] ?? inspectedJob.status}</Badge>
          ) : undefined
        }
        fullRecordHref={inspectedJob ? `/print-jobs/${inspectedJob.id}` : undefined}
        metrics={
          inspectedJob
            ? [
                { label: "Quoted Price", value: formatINR(inspectedJob.quoted_price) },
                { label: "Priority", value: inspectedJob.priority.toUpperCase() },
              ]
            : []
        }
        sections={
          inspectedJob
            ? [
                {
                  title: "Job Specifications",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Product Type:</span>
                        <span className="font-medium text-foreground">{inspectedJob.job_type}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span className="font-medium text-foreground">{inspectedJob.quantity}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Target Due Date:</span>
                        <span className="font-medium text-foreground">{inspectedJob.due_date || "Not specified"}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Production Stage",
                  content: (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Current stage: <strong>{STATUS_LABELS[inspectedJob.status] ?? inspectedJob.status}</strong>. Manage prepress proofs, machine assignment, paper cutting, and finishing operations on the production ticket.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/print-jobs/${inspectedJob.id}`}>
                          Open Production Sheet &rarr;
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
