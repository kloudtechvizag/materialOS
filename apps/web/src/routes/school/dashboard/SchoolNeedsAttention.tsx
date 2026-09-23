import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

import type { NeedsAttentionItem } from "./types";

const SEVERITY_BADGE: Record<NeedsAttentionItem["severity"], string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
  low: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400",
};

/** Real, backend-permission-gated items only (see services/
 * school_dashboard.py) -- a category with zero real count never
 * appears, and this list is empty either because everything is
 * genuinely clear OR because the user holds none of the relevant
 * permissions. Both read as the same honest positive state: there is
 * nothing real to act on that this user can see. */
export function SchoolNeedsAttention({ items, isLoading }: { items: NeedsAttentionItem[] | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Needs attention</p>
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}
      {!isLoading && (!items || items.length === 0) && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Nothing needs attention right now.</span>
        </div>
      )}
      {!isLoading && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="flex items-center gap-2">
                {item.severity === "high" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                {item.label}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", SEVERITY_BADGE[item.severity])}>{item.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
