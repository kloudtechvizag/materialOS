import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { PIPELINE_STAGE_LABEL, type SchoolDashboardAdmissionsPipeline } from "./types";

const STAGE_ORDER = ["open", "contacted", "application_started", "converted", "closed"];

/** Reuses GET /admission-enquiries/summary's own real payload verbatim
 * (services/admissions.py::get_admissions_summary) -- no separate
 * pipeline status system, per the master prompt's own "do not
 * duplicate admission business logic" instruction. */
export function SchoolAdmissionsSnapshot({ pipeline, isLoading }: { pipeline: SchoolDashboardAdmissionsPipeline | null | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Admissions</p>
        <Link to="/admission-enquiries" className="text-xs font-medium text-primary hover:underline">
          View all admissions &rarr;
        </Link>
      </div>

      {isLoading && <div className="h-24 animate-pulse rounded-md bg-muted" />}

      {!isLoading && !pipeline && <p className="text-sm text-muted-foreground">You don&apos;t have permission to view admissions.</p>}

      {!isLoading && pipeline && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.map((stage) => (
              <Link
                key={stage}
                to={stage === "closed" ? "/admission-enquiries" : "/admission-enquiries"}
                className={cn(
                  "flex flex-1 min-w-[6rem] flex-col items-start gap-0.5 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <span className="text-[11px] text-muted-foreground">{PIPELINE_STAGE_LABEL[stage] ?? stage}</span>
                <span className="text-base font-semibold">{pipeline.pipeline[stage] ?? 0}</span>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{pipeline.new_enquiries} new this week</span>
            {pipeline.overdue_follow_ups > 0 && <span className="font-medium text-red-600 dark:text-red-400">{pipeline.overdue_follow_ups} follow-ups overdue</span>}
            {pipeline.conversion_rate_pct !== null && <span>{pipeline.conversion_rate_pct}% conversion rate</span>}
          </div>
        </div>
      )}
    </div>
  );
}
