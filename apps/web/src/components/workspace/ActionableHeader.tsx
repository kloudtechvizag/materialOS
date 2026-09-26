import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface HeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
}

export interface ActionableHeaderProps {
  title: string;
  subtitle?: ReactNode;
  description?: ReactNode;
  badge?:
    | string
    | {
        label: string;
        variant?: "outline" | "secondary" | "success" | "destructive" | "default";
      };
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  children?: ReactNode;
}

export function ActionableHeader({
  title,
  subtitle,
  description,
  badge,
  primaryAction,
  secondaryActions = [],
  children,
}: ActionableHeaderProps) {
  const badgeConfig =
    typeof badge === "string" ? { label: badge, variant: "outline" as const } : badge;
  const subContent = subtitle ?? description;

  return (
    <div className="flex flex-col gap-4 border-b border-border/40 pb-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badgeConfig && (
            <Badge variant={badgeConfig.variant ?? "outline"} className="text-xs font-medium">
              {badgeConfig.label}
            </Badge>
          )}
        </div>
        {subContent && (
          <div className="text-sm text-muted-foreground">{subContent}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {secondaryActions.map((action, i) => {
          const Icon = action.icon;
          if (action.href) {
            return (
              <Button key={i} asChild variant={action.variant ?? "outline"} size="sm">
                <Link to={action.href}>
                  {Icon && <Icon className="mr-1.5 h-4 w-4" />}
                  <span>{action.label}</span>
                </Link>
              </Button>
            );
          }
          return (
            <Button
              key={i}
              type="button"
              variant={action.variant ?? "outline"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {Icon && <Icon className="mr-1.5 h-4 w-4" />}
              <span>{action.label}</span>
            </Button>
          );
        })}

        {primaryAction && (
          primaryAction.href ? (
            <Button asChild variant={primaryAction.variant ?? "default"} size="sm">
              <Link to={primaryAction.href}>
                {primaryAction.icon && <primaryAction.icon className="mr-1.5 h-4 w-4" />}
                <span>{primaryAction.label}</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant={primaryAction.variant ?? "default"}
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon && <primaryAction.icon className="mr-1.5 h-4 w-4" />}
              <span>{primaryAction.label}</span>
            </Button>
          )
        )}

        {children}
      </div>
    </div>
  );
}
