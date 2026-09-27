import { NavLink } from "react-router-dom";

import { SidebarTooltip } from "@/components/layout/sidebar/SidebarTooltip";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  /** Fired on click -- lets the mobile drawer close itself on selection. */
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <SidebarTooltip label={item.label} show={collapsed}>
      <NavLink
        to={item.href}
        end={item.end}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            "group relative flex h-9 items-center rounded-lg text-sm font-medium transition-all duration-150 select-none",
            collapsed ? "w-full justify-center px-0" : "w-full gap-3 px-3",
            isActive
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-sm shadow-violet-500/30 ring-1 ring-white/15"
              : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100 active:scale-[0.98]"
          )
        }
      >
        {/* NavLink already sets aria-current="page" on the active link. */}
        <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105" aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-white tracking-wide border border-white/20">
                {item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge !== undefined && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-400 ring-2 ring-slate-950" />
        )}
      </NavLink>
    </SidebarTooltip>
  );
}
