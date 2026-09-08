import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
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
  urgent: "border-destructive/40 bg-destructive/5",
  express: "border-destructive/40 bg-destructive/5",
  high: "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20",
  normal: "",
};

function JobChip({ job }: { job: JobCard }) {
  return (
    <Link to={`/print-jobs/${job.id}`}>
      <Card className={cn("transition-colors hover:bg-accent/50", PRIORITY_STYLES[job.priority] ?? "")}>
        <CardContent className="space-y-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-primary">{job.number}</p>
            {job.priority !== "normal" && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                {job.priority}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{job.job_type} &middot; {job.quantity}</p>
          {job.due_date && <p className="text-xs text-muted-foreground">Due {job.due_date}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

/** Kanban production board (sec22), server-grouped by status -- same
 * shape as GET /dispatch-board, just more columns since a print job's
 * lifecycle has more real stages than a delivery's. */
export function ProductionBoardPage() {
  const { data: board, isLoading, error, refetch } = useQuery({
    queryKey: ["printing-board"],
    queryFn: () => apiFetch<Record<string, JobCard[]>>("/printing-board"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Production board</h1>
        <p className="text-sm text-muted-foreground">Every open job, grouped by production stage.</p>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {board && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(COLUMN_LABELS).map(([status, label]) => {
            const jobs = board[status] ?? [];
            return (
              <div key={status} className="w-64 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="text-xs text-muted-foreground">{jobs.length}</span>
                </div>
                <div className="space-y-2">
                  {jobs.map((job) => <JobChip key={job.id} job={job} />)}
                  {jobs.length === 0 && <p className="text-xs text-muted-foreground">No jobs</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
