import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [{ to: "/guardian-portal", label: "My children", icon: LayoutDashboard, end: true }];

/** Mirrors PortalShell.tsx (customer portal) exactly -- its own
 * chrome, not a reduced view of the internal staff dashboard. */
export function GuardianPortalShell() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  function handleLogout() {
    clearSession();
    navigate("/guardian-portal/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col bg-brand-navy text-brand-navy-foreground">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <img src="/brand/symbol.svg" alt="" className="h-7 w-7" />
          <span className="text-sm font-semibold">Parent Portal</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-brand-navy-muted hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-navy-muted hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
          <span className="text-sm text-muted-foreground">{tenantSlug} · Parent portal</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
