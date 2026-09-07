import { Menu } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileDrawer } from "@/components/layout/sidebar/MobileDrawer";
import { SidebarFooter } from "@/components/layout/sidebar/SidebarFooter";
import { SidebarHeader } from "@/components/layout/sidebar/SidebarHeader";
import { SidebarNav } from "@/components/layout/sidebar/SidebarNav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";

export function AppShell() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Desktop/tablet sidebar (>=768px) -- collapsible to an icon-only rail.
          Below that, navigation lives entirely in the MobileDrawer. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-brand-navy text-brand-navy-foreground transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <SidebarHeader collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <SidebarNav collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} onLogout={handleLogout} />
      </aside>

      <MobileDrawer />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="text-sm text-muted-foreground">{tenantSlug}</span>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
