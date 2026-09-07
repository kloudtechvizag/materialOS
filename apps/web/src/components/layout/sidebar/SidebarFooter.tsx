import { LogOut } from "lucide-react";

import { SidebarTooltip } from "@/components/layout/sidebar/SidebarTooltip";
import { cn } from "@/lib/utils";

export function SidebarFooter({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  return (
    <div className="shrink-0 border-t border-white/10 p-3">
      <SidebarTooltip label="Log out" show={collapsed}>
        <button
          onClick={onLogout}
          aria-label={collapsed ? "Log out" : undefined}
          className={cn(
            "flex h-9 w-full items-center rounded-md text-sm font-medium text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-white",
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && "Log out"}
        </button>
      </SidebarTooltip>
    </div>
  );
}
