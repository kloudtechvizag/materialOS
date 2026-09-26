import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type MetricColor =
  | "violet"
  | "emerald"
  | "orange"
  | "sky"
  | "amber"
  | "rose"
  | "indigo"
  | "slate"
  | "primary"
  | "blue"
  | "neutral"
  | "red"
  | "green";

const BASE_COLOR_CLASSES = {
  violet: {
    bg: "bg-violet-100 dark:bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-300",
    ring: "border-violet-500/30",
  },
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-300",
    ring: "border-emerald-500/30",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-300",
    ring: "border-orange-500/30",
  },
  sky: {
    bg: "bg-sky-100 dark:bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-300",
    ring: "border-sky-500/30",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-300",
    ring: "border-amber-500/30",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-300",
    ring: "border-rose-500/30",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-500/15",
    text: "text-indigo-600 dark:text-indigo-300",
    ring: "border-indigo-500/30",
  },
  slate: {
    bg: "bg-muted dark:bg-muted/60",
    text: "text-muted-foreground",
    ring: "border-border",
  },
};

const COLOR_CLASSES: Record<MetricColor, { bg: string; text: string; ring: string }> = {
  ...BASE_COLOR_CLASSES,
  primary: BASE_COLOR_CLASSES.indigo,
  blue: BASE_COLOR_CLASSES.sky,
  neutral: BASE_COLOR_CLASSES.slate,
  red: BASE_COLOR_CLASSES.rose,
  green: BASE_COLOR_CLASSES.emerald,
};

export interface MetricItem {
  id?: string;
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  color?: MetricColor;
  active?: boolean;
  onClick?: () => void;
}

export function MetricStrip({ metrics }: { metrics: MetricItem[] }) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-3",
        metrics.length === 1 && "grid-cols-1",
        metrics.length === 2 && "grid-cols-1 sm:grid-cols-2",
        metrics.length === 3 && "grid-cols-1 sm:grid-cols-3",
        metrics.length === 4 && "grid-cols-2 lg:grid-cols-4",
        metrics.length >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      )}
    >
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        const color = m.color ?? "slate";
        const theme = COLOR_CLASSES[color];
        const isClickable = !!m.onClick;

        return (
          <div
            key={m.id ?? idx}
            onClick={m.onClick}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                m.onClick?.();
              }
            }}
            className={cn(
              "group relative flex items-center justify-between rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all",
              isClickable && "cursor-pointer hover:border-primary/50 hover:bg-accent/40 hover:shadow",
              m.active && "border-primary ring-2 ring-primary/20 bg-primary/5"
            )}
          >
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-xs font-medium text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 truncate text-lg font-bold tracking-tight text-foreground md:text-xl">
                {m.value}
              </p>
              {m.sublabel && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.sublabel}</p>
              )}
            </div>

            {Icon && (
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                  theme.bg,
                  theme.text
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
