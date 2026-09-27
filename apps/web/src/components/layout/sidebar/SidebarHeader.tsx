import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function SidebarHeader({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse?: () => void }) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-white/[0.08] px-3",
        collapsed ? "flex-col justify-center gap-1.5 px-0 py-2" : "gap-2.5 px-3.5"
      )}
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border border-violet-500/30 p-1">
        <img src="/brand/symbol.svg" alt="MaterialOS" className="h-5 w-5 drop-shadow" />
      </div>
      {!collapsed && (
        <div className="flex flex-1 min-w-0 items-center justify-between">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight text-white">MaterialOS</span>
              <span className="rounded bg-violet-500/20 px-1 py-0.2 text-[9px] font-bold text-violet-300 uppercase tracking-widest border border-violet-500/30">
                Pro
              </span>
            </div>
          </div>
        </div>
      )}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:scale-95"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
