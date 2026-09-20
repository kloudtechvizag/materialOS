import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/** Compact KPI card -- replaces the old large-icon-box design (40x40
 * icon + generous padding) that read as a static label rather than a
 * piece of business intelligence. No icon at all here: a page full of
 * near-identical purple squares didn't help recognition, and a small
 * uppercase label plus a real status hint does more real work in less
 * space. `hint` is optional and only ever a real, backend-derived
 * status ("Needs review", "In progress") -- never a fabricated trend,
 * per the "no meaningless comparisons" rule. */
export function Kpi({
  label,
  value,
  hint,
  hintTone = "muted",
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  hintTone?: "muted" | "warning" | "positive";
  to?: string;
}) {
  const toneClass =
    hintTone === "warning" ? "text-amber-600 dark:text-amber-500" : hintTone === "positive" ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground";

  const content = (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-border bg-card px-4 py-3",
        to && "transition-colors hover:border-primary/40 hover:bg-accent/40"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className={cn("mt-0.5 text-xs", toneClass)}>{hint}</p>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
