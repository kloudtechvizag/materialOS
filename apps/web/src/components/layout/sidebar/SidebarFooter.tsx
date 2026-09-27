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
    <div className="shrink-0 space-y-1 border-t border-white/[0.08] p-2.5">
      <SidebarTooltip label="Settings" show={collapsed}>
        <NavLink
          to="/settings"
          aria-label={collapsed ? "Settings" : undefined}
          className={({ isActive }) =>
            cn(
              "group flex h-9 w-full items-center rounded-lg text-sm font-medium transition-all duration-150 select-none",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              isActive ? "bg-white/[0.12] text-white font-semibold" : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:rotate-45" aria-hidden="true" />
          {!collapsed && "Settings"}
        </NavLink>
      </SidebarTooltip>
      <SidebarTooltip label="Log out" show={collapsed}>
        <button
          onClick={onLogout}
          aria-label={collapsed ? "Log out" : undefined}
          className={cn(
            "group flex h-9 w-full items-center rounded-lg text-sm font-medium text-slate-400 transition-all duration-150 hover:bg-rose-500/10 hover:text-rose-400 select-none",
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" aria-hidden="true" />
          {!collapsed && "Log out"}
        </button>
      </SidebarTooltip>
    </div>
  );
}
