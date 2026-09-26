import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ViewOption {
  id: string;
  label: string;
  count?: number | string;
  badgeVariant?: "default" | "destructive" | "warning" | "outline";
}

export interface SavedViewsProps {
  views?: ViewOption[];
  tabs?: ViewOption[];
  activeView?: string;
  activeTab?: string;
  onViewChange?: (viewId: string) => void;
  onTabChange?: (tabId: string) => void;
  search?: string;
  searchQuery?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export function SavedViews({
  views,
  tabs,
  activeView,
  activeTab,
  onViewChange,
  onTabChange,
  search,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search records...",
  children,
  hasActiveFilters,
  onClearFilters,
  className,
}: SavedViewsProps) {
  const effectiveViews = views || tabs || [];
  const currentActive = activeView || activeTab || effectiveViews[0]?.id || "";
  const handleViewSelect = (id: string) => {
    if (onViewChange) onViewChange(id);
    if (onTabChange) onTabChange(id);
  };
  const currentSearch = search !== undefined ? search : (searchQuery !== undefined ? searchQuery : "");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {effectiveViews.map((v) => {
            const isActive = currentActive === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleViewSelect(v.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{v.label}</span>
                {v.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      isActive
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {v.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Actions Slot */}
        <div className="flex items-center gap-2">
          {onSearchChange && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={currentSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 pr-7 text-xs"
              />
              {currentSearch && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
