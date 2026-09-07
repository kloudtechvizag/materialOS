import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function SidebarHeader({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse?: () => void }) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-white/10",
        collapsed ? "flex-col justify-center gap-1 px-0 py-2" : "gap-2 px-4"
      )}
    >
      <img src="/brand/symbol.png" alt="" className="h-7 w-7 shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-sm font-semibold">MaterialOS</span>}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
