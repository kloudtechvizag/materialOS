import { CheckCircle2, FilterX, Settings2, Sparkles, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateType = "first-time" | "operational" | "filtered" | "setup";

export interface EmptyAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary";
}

export interface SmartEmptyStateProps {
  type?: EmptyStateType;
  mode?: EmptyStateType;
  icon?: LucideIcon;
  title: string;
  description: string;
  tip?: string;
  actionLabel?: string;
  onAction?: () => void;
  primaryAction?: EmptyAction;
  secondaryActions?: EmptyAction[];
  className?: string;
}

const DEFAULT_ICONS: Record<EmptyStateType, LucideIcon> = {
  "first-time": Sparkles,
  operational: CheckCircle2,
  filtered: FilterX,
  setup: Settings2,
};

export function SmartEmptyState({
  type,
  mode,
  icon,
  title,
  description,
  tip,
  actionLabel,
  onAction,
  primaryAction,
  secondaryActions = [],
  className,
}: SmartEmptyStateProps) {
  const resolvedType = mode ?? type ?? "first-time";
  const Icon = icon ?? DEFAULT_ICONS[resolvedType];
  const resolvedPrimaryAction =
    primaryAction ??
    (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 p-8 text-center sm:p-12",
        className
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-transform hover:scale-105",
          resolvedType === "operational"
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
            : resolvedType === "filtered"
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary dark:bg-primary/20"
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>

      <h3 className="text-base font-semibold text-foreground tracking-tight sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {tip && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>{tip}</span>
        </div>
      )}

      {(resolvedPrimaryAction || secondaryActions.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryActions.map((act, i) => {
            const ActIcon = act.icon;
            if (act.href) {
              return (
                <Button key={i} asChild variant={act.variant ?? "outline"} size="sm">
                  <Link to={act.href}>
                    {ActIcon && <ActIcon className="mr-1.5 h-4 w-4" />}
                    {act.label}
                  </Link>
                </Button>
              );
            }
            return (
              <Button
                key={i}
                type="button"
                variant={act.variant ?? "outline"}
                size="sm"
                onClick={act.onClick}
              >
                {ActIcon && <ActIcon className="mr-1.5 h-4 w-4" />}
                {act.label}
              </Button>
            );
          })}

          {resolvedPrimaryAction && (
            resolvedPrimaryAction.href ? (
              <Button asChild size="sm" variant={resolvedPrimaryAction.variant ?? "default"}>
                <Link to={resolvedPrimaryAction.href}>
                  {resolvedPrimaryAction.icon && <resolvedPrimaryAction.icon className="mr-1.5 h-4 w-4" />}
                  {resolvedPrimaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={resolvedPrimaryAction.variant ?? "default"}
                onClick={resolvedPrimaryAction.onClick}
              >
                {resolvedPrimaryAction.icon && <resolvedPrimaryAction.icon className="mr-1.5 h-4 w-4" />}
                {resolvedPrimaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
