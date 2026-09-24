import { LogOut, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

import { SidebarTooltip } from "@/components/layout/sidebar/SidebarTooltip";
import { cn } from "@/lib/utils";

/** ADR-048: the one Settings entry point -- an account-level utility
 * link (alongside Log out), not a business-workflow nav item, so it
 * lives here rather than in lib/navigation.ts's GLOBAL_NAV_ITEMS.
 * Everything Settings-specific (categories, profile/permission
 * filtering) is the SettingsLayout's own concern once inside
 * `/settings/*`. */
export function SidebarFooter({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  return (
    <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
      <SidebarTooltip label="Settings" show={collapsed}>
        <NavLink
          to="/settings"
          aria-label={collapsed ? "Settings" : undefined}
          className={({ isActive }) =>
            cn(
              "flex h-9 w-full items-center rounded-md text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              isActive ? "bg-white/10 text-white" : "text-brand-navy-muted hover:bg-white/10 hover:text-white"
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && "Settings"}
        </NavLink>
      </SidebarTooltip>
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
