import type { LucideIcon } from "lucide-react";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NextBestActionProps {
  title?: string;
  recommendation: string;
  reason?: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  badge?: string;
  className?: string;
}

export function NextBestAction({
  title = "Next Best Action",
  recommendation,
  reason,
  actionLabel,
  actionHref,
  onAction,
  icon: Icon = Compass,
  badge,
  className,
}: NextBestActionProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {title}
              </span>
              {badge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground">{recommendation}</p>
            {reason && <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>}
          </div>
        </div>

        <div className="shrink-0 pl-12 sm:pl-0">
          {actionHref ? (
            <Button asChild size="sm" className="shadow-sm">
              <Link to={actionHref}>
                <span>{actionLabel}</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onAction} className="shadow-sm">
              <span>{actionLabel}</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
