import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiColor = "violet" | "emerald" | "orange" | "sky" | "amber";

/** Tailwind's built-in color scales (not this app's CSS-variable design
 * tokens) -- picked because they already ship a dark-mode-appropriate
 * shade at every step, so "just add dark:" is a real fix, not a
 * one-off dark palette invented for this one component. Icon color
 * rides on the div's own `text-*` via SVG currentColor -- no separate
 * class needed on the icon itself. */
const COLOR_CLASSES: Record<KpiColor, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
};

interface KpiCardProps {
  icon: LucideIcon;
  color: KpiColor;
  label: string;
  value: string;
}

/** Small stat tile (icon badge + label + value) used at the top of
 * list pages -- previously duplicated per-page with hardcoded hex
 * (LeadsPage, SuppliersPage) that couldn't respond to dark mode.
 * Centralized here so both the styling and any future page adopting
 * this pattern stay in one place. */
export function KpiCard({ icon: Icon, color, label, value }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", COLOR_CLASSES[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}
