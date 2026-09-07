import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  UploadCloud,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/items", label: "Items", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/projects", label: "Projects", icon: Building },
  { to: "/imports", label: "Import from Tally/Busy", icon: UploadCloud },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/users", label: "Users", icon: Users },
];

export function AppShell() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            M
          </div>
          <span className="text-sm font-semibold">MaterialOS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
          <span className="text-sm text-muted-foreground">{tenantSlug}</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
