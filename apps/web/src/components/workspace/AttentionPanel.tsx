import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export type AttentionSeverity = "critical" | "warning" | "info" | "success";

export interface AttentionItem {
  id: string;
  title: string;
  count?: number | string;
  description?: string;
  severity: AttentionSeverity;
  actionLabel?: string;
  href?: string;
  actionHref?: string;
  onClick?: () => void;
  onAction?: () => void;
}

const SEVERITY_STYLES: Record<
  AttentionSeverity,
  {
    icon: LucideIcon;
    badgeBg: string;
    badgeText: string;
    border: string;
    bg: string;
    dot: string;
  }
> = {
  critical: {
    icon: AlertCircle,
    badgeBg: "bg-rose-100 dark:bg-rose-500/20",
    badgeText: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900/50",
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    dot: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: "bg-amber-100 dark:bg-amber-500/20",
    badgeText: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900/50",
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    dot: "bg-amber-500",
  },
  info: {
    icon: Info,
    badgeBg: "bg-sky-100 dark:bg-sky-500/20",
    badgeText: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-900/50",
    bg: "bg-sky-50/50 dark:bg-sky-950/20",
    dot: "bg-sky-500",
  },
  success: {
    icon: CheckCircle2,
    badgeBg: "bg-emerald-100 dark:bg-emerald-500/20",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900/50",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
  },
};

export interface AttentionPanelProps {
  title?: string;
  items: AttentionItem[];
  allClearMessage?: string;
  collapsedDefault?: boolean;
  className?: string;
}

export function AttentionPanel({
  title = "Needs Attention",
  items,
  allClearMessage,
  className,
}: AttentionPanelProps) {
  const activeItems = items.filter((i) => i.count === undefined || i.count !== 0);

  if (activeItems.length === 0) {
    if (!allClearMessage) return null;
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{allClearMessage}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {activeItems.length}
          </span>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {activeItems.map((item) => {
          const style = SEVERITY_STYLES[item.severity];
          const Icon = style.icon;
          const targetHref = item.href || item.actionHref;
          const targetClick = item.onClick || item.onAction;

          const content = (
            <div
              className={cn(
                "group relative flex flex-col justify-between rounded-lg border p-3 transition-all",
                style.bg,
                style.border,
                (targetHref || targetClick) && "cursor-pointer hover:shadow-xs hover:border-foreground/30"
              )}
              onClick={targetClick}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", style.badgeText)} />
                    <span className="text-xs font-semibold text-foreground">
                      {item.title}
                    </span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0",
                        style.badgeBg,
                        style.badgeText
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>

              {item.actionLabel && (
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </div>
          );

          if (targetHref) {
            return (
              <Link key={item.id} to={targetHref} className="block">
                {content}
              </Link>
            );
          }

          return <div key={item.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
