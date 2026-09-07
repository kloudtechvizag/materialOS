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
            "relative flex h-9 items-center rounded-md text-sm font-medium transition-colors",
            collapsed ? "w-full justify-center px-0" : "w-full gap-3 px-3",
            isActive
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-brand-navy-muted hover:bg-white/10 hover:text-white"
          )
        }
      >
        {/* NavLink already sets aria-current="page" on the active link. */}
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                {item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge !== undefined && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </NavLink>
    </SidebarTooltip>
  );
}
