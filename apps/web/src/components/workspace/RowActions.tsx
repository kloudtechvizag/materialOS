import type { LucideIcon } from "lucide-react";
import { Copy, Edit3, ExternalLink, Eye, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
  id?: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface QuickRowAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "ghost" | "outline" | "default";
}

export interface RowActionsProps {
  quickActions?: QuickRowAction[];
  actions?: RowAction[];
  onView?: () => void;
  onPeek?: () => void;
  onQuickPeek?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  viewLabel?: string;
  detailHref?: string;
  className?: string;
}

export function RowActions({
  quickActions = [],
  actions = [],
  onView,
  onPeek,
  onQuickPeek,
  onEdit,
  onCopy,
  viewLabel = "Quick View",
  detailHref,
  className,
}: RowActionsProps) {
  const combinedQuickActions = [...quickActions];

  const handleInspect = onView || onQuickPeek || onPeek;
  if (handleInspect) {
    combinedQuickActions.unshift({
      id: "inspect",
      label: viewLabel,
      icon: Eye,
      onClick: handleInspect,
      title: viewLabel,
    });
  }

  if (onEdit) {
    combinedQuickActions.push({
      id: "edit",
      label: "Edit",
      icon: Edit3,
      onClick: onEdit,
      title: "Edit record",
    });
  }

  if (onCopy) {
    combinedQuickActions.push({
      id: "copy",
      label: "Copy",
      icon: Copy,
      onClick: onCopy,
      title: "Copy reference",
    });
  }

  const hasAny = combinedQuickActions.length > 0 || actions.length > 0 || Boolean(detailHref);
  if (!hasAny) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {combinedQuickActions.map((qa) => {
        const Icon = qa.icon;
        return (
          <Button
            key={qa.id}
            type="button"
            variant={qa.variant ?? "ghost"}
            size="icon"
            onClick={qa.onClick}
            disabled={qa.disabled}
            title={qa.title ?? qa.label}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="sr-only">{qa.label}</span>
          </Button>
        );
      })}

      {detailHref && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          title="Open Record"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Link to={detailHref}>
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">Open Record</span>
          </Link>
        </Button>
      )}

      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id}>
                  {act.separatorBefore && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={act.onClick}
                    disabled={act.disabled}
                    className={
                      act.variant === "destructive"
                        ? "text-destructive focus:text-destructive"
                        : ""
                    }
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <span>{act.label}</span>
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
