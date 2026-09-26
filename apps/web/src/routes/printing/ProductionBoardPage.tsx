import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ListFilter,
  Plus,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  DetailDrawer,
  MetricStrip,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface JobCard {
  id: string;
  number: string;
  job_type: string;
  quantity: string;
  priority: string;
  due_date: string | null;
}

const COLUMN_LABELS: Record<string, string> = {
  draft: "New Jobs",
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
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-red-500/50 bg-red-50/40 dark:bg-red-950/20",
  express: "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20",
  high: "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10",
  normal: "border-border bg-card",
};

export function ProductionBoardPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);

  const {
    data: board,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["printing-board"],
    queryFn: () => apiFetch<Record<string, JobCard[]>>("/printing-board"),
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!board) return [];
    let totalJobs = 0;
    let urgentCount = 0;
    let activePressCount = 0;
    let readyDispatchCount = 0;

    Object.entries(board).forEach(([status, jobs]) => {
      totalJobs += jobs.length;
      if (status === "printing" || status === "finishing" || status === "ready_to_print") {
        activePressCount += jobs.length;
      }
      if (status === "ready_for_pickup" || status === "dispatched") {
        readyDispatchCount += jobs.length;
      }
      jobs.forEach((j) => {
        if (j.priority === "urgent" || j.priority === "express") {
          urgentCount++;
        }
      });
    });

    return [
      {
        id: "total",
        label: "Floor Jobs Active",
        value: totalJobs,
        sublabel: "Across all 13 production stages",
        icon: Printer,
        color: "primary",
      },
      {
        id: "press",
        label: "Press & Finishing Run",
        value: activePressCount,
        sublabel: "Currently on machine beds",
        icon: Clock,
        color: "blue",
      },
      {
        id: "urgent",
        label: "Urgent & Express Jobs",
        value: urgentCount,
        sublabel: "Immediate SLA priority",
        icon: AlertTriangle,
        color: urgentCount > 0 ? "amber" : "neutral",
      },
      {
        id: "ready",
        label: "Ready for Pickup",
        value: readyDispatchCount,
        sublabel: "Packing / customer collection",
        icon: CheckCircle2,
        color: "emerald",
      },
    ];
  }, [board]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!board) return [];
    const list: AttentionItem[] = [];

    const reworkJobs = board["rework"] ?? [];
    if (reworkJobs.length > 0) {
      list.push({
        id: "rework-jobs",
        title: `${reworkJobs.length} job${reworkJobs.length > 1 ? "s" : ""} flagged for quality rework`,
        description: "Failed QC inspection. Requires reprinted sheets or re-binding before packaging.",
        severity: "critical",
        count: reworkJobs.length,
      });
    }

    const artworkPending = board["artwork_pending"] ?? [];
    if (artworkPending.length > 0) {
      list.push({
        id: "artwork-blocked",
        title: `${artworkPending.length} job${artworkPending.length > 1 ? "s" : ""} waiting for artwork approval`,
        description: "Prepress is halted until client proofing is signed off.",
        severity: "warning",
        count: artworkPending.length,
      });
    }

    const urgentJobs: JobCard[] = [];
    Object.values(board).forEach((jobs) => {
      jobs.forEach((j) => {
        if (j.priority === "urgent") urgentJobs.push(j);
      });
    });

    if (urgentJobs.length > 0) {
      list.push({
        id: "urgent-jobs",
        title: `${urgentJobs.length} STAT / Urgent turnaround job${urgentJobs.length > 1 ? "s" : ""} in progress`,
        description: "Check schedule deadlines to guarantee same-day release.",
        severity: "info",
        count: urgentJobs.length,
      });
    }

    return list;
  }, [board]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Pressroom Production Board"
        description="Real-time floor kanban tracking commercial print orders from prepress and plate-making to press run, finishing, and dispatch."
        primaryAction={{
          label: "New Print Job",
          icon: Plus,
          onClick: () => navigate("/print-jobs"),
        }}
        secondaryActions={[
          {
            label: "Table View",
            icon: ListFilter,
            onClick: () => navigate("/print-jobs"),
          },
          {
            label: isFetching ? "Refreshing..." : "Refresh Board",
            icon: RefreshCw,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* 2. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Pressroom Escalations & Holds"
        items={attentionItems}
        allClearMessage="All jobs moving smoothly through prepress and print runs without production holds."
      />

      {/* 4. Search Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter jobs by # or type..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            Clear
          </Button>
        )}
      </div>

      {/* 5. Production Kanban Board */}
      {isLoading && <Skeleton className="h-96 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {board && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(COLUMN_LABELS).map(([status, label]) => {
            const rawJobs = board[status] ?? [];
            const jobs = search.trim()
              ? rawJobs.filter(
                  (j) =>
                    j.number.toLowerCase().includes(search.toLowerCase()) ||
                    j.job_type.toLowerCase().includes(search.toLowerCase())
                )
              : rawJobs;

            return (
              <div
                key={status}
                className="w-72 shrink-0 rounded-lg border border-border bg-muted/10 p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {label}
                    </h3>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {jobs.length}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-0.5">
                  {jobs.map((job) => (
                    <Card
                      key={job.id}
                      className={cn(
                        "transition-all hover:shadow-md cursor-pointer",
                        PRIORITY_STYLES[job.priority] ?? "border-border bg-card"
                      )}
                      onClick={() => setSelectedJob(job)}
                    >
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/print-jobs/${job.id}`}
                            className="text-sm font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {job.number}
                          </Link>
                          {job.priority !== "normal" && (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                              {job.priority}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{job.job_type}</span>
                          <span>Qty: {job.quantity}</span>
                        </div>

                        {job.due_date && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <Clock className="h-3 w-3" />
                            <span>Due {job.due_date}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {jobs.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                      No jobs at this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Quick Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob?.number ?? "Job Details"}
        subtitle="Commercial Print Job Card Snapshot"
        badge={selectedJob?.priority ? <StatusBadge status={selectedJob.priority} /> : undefined}
        metrics={[
          {
            label: "Product Type",
            value: selectedJob?.job_type ?? "—",
          },
          {
            label: "Print Run Qty",
            value: selectedJob?.quantity ?? "—",
          },
          {
            label: "Priority",
            value: selectedJob?.priority?.toUpperCase() ?? "NORMAL",
          },
          {
            label: "Delivery Due",
            value: selectedJob?.due_date ?? "Standard",
          },
        ]}
        actions={
          selectedJob ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                navigate(`/print-jobs/${selectedJob.id}`);
              }}
            >
              <Eye className="h-4 w-4" />
              Open Job 360 Workspace
            </Button>
          ) : undefined
        }
      >
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          Open the full job card to review paper stock specs, ink separations, imposition proofing, and press run logs.
        </div>
      </DetailDrawer>
    </div>
  );
}
