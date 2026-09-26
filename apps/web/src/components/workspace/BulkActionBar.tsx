import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkActionItem {
  id?: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive";
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount?: number;
  onClearSelection?: () => void;
  onClear?: () => void;
  onSelectAll?: () => void;
  actions: BulkActionItem[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  onClear,
  onSelectAll,
  actions,
  className,
}: BulkActionBarProps) {
  const handleClear = onClear || onClearSelection || (() => {});

  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border/80 bg-background/95 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4",
        className
      )}
    >
      <div className="flex items-center gap-2 border-r border-border pr-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {selectedCount}
        </span>
        <span className="text-xs font-medium text-foreground">
          {selectedCount} selected
        </span>
        {totalCount !== undefined && selectedCount < totalCount && onSelectAll && (
          <button
            type="button"
            onClick={onSelectAll}
            className="ml-1 text-xs text-primary hover:underline"
          >
            Select all {totalCount}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions.map((act, i) => {
          const Icon = act.icon;
          return (
            <Button
              key={act.id ?? i}
              type="button"
              variant={act.variant ?? "default"}
              size="sm"
              onClick={act.onClick}
              disabled={act.disabled}
              className="h-8 text-xs font-medium"
            >
              {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
              <span>{act.label}</span>
            </Button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleClear}
        className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
