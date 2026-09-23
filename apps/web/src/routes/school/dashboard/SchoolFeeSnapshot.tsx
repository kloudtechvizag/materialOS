import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatINRCompact } from "@/lib/format";

import type { SchoolDashboardFeeSnapshot } from "./types";

export function SchoolFeeSnapshot({ fees, isLoading }: { fees: SchoolDashboardFeeSnapshot | null | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Fee collection</p>
        <Link to="/fees" className="text-xs font-medium text-primary hover:underline">
          View fee reports &rarr;
        </Link>
      </div>

      {isLoading && <div className="h-24 animate-pulse rounded-md bg-muted" />}

      {!isLoading && !fees && <p className="text-sm text-muted-foreground">You don&apos;t have permission to view fee data.</p>}

      {!isLoading && fees && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-base font-semibold">{formatINRCompact(fees.collected_today)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="text-base font-semibold">{formatINRCompact(fees.collected_this_month)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-base font-semibold">{formatINRCompact(fees.outstanding_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue accounts</p>
              <p className={`text-base font-semibold ${fees.overdue_accounts > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{fees.overdue_accounts}</p>
            </div>
          </div>

          {fees.collection_rate_pct !== null && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Collection rate</span>
                <span className="font-medium text-foreground">{fees.collection_rate_pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, fees.collection_rate_pct)}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline"><Link to="/fees">Collect fee</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/fees">View outstanding</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}
