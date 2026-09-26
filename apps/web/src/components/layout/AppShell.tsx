import { useState } from "react";
import { Keyboard, LifeBuoy, Menu, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { CommandPalette } from "@/components/CommandPalette";
import { DesktopUpdateNotifier } from "@/components/DesktopUpdateNotifier";
import { DensityToggle } from "@/components/layout/DensityToggle";
import { KeyboardShortcutsModal } from "@/components/layout/KeyboardShortcutsModal";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { OnboardingTourCard } from "@/components/layout/OnboardingTourCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { MobileDrawer } from "@/components/layout/sidebar/MobileDrawer";
import { SidebarFooter } from "@/components/layout/sidebar/SidebarFooter";
import { SidebarHeader } from "@/components/layout/sidebar/SidebarHeader";
import { SidebarNav } from "@/components/layout/sidebar/SidebarNav";
import { apiFetch } from "@/lib/api";
import { useAuthenticatedImage } from "@/lib/useAuthenticatedImage";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useCommandPaletteStore } from "@/store/commandPalette";
import { useSidebarStore } from "@/store/sidebar";

export function AppShell({ children }: { children?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const [keyboardModalOpen, setKeyboardModalOpen] = useState(false);
  const clearSession = useAuthStore((s) => s.clearSession);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const openCommandPalette = useCommandPaletteStore((s) => s.setOpen);

  const { data: tenantSettings } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () => apiFetch<{ name: string; slug: string; logo_url: string | null }>("/tenant/settings"),
    staleTime: 5 * 60 * 1000,
  });
  const tenantLogoUrl = useAuthenticatedImage(tenantSettings?.logo_url ?? null, tenantSettings?.logo_url);

  // Only a token minted by create_impersonation_token (ADR-020) carries
  // this claim -- a normal login's own token never does, so this banner
  // can never appear for a tenant's own real session.
  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiFetch<{ impersonated_by_admin_id: string | null }>("/auth/me"),
    staleTime: Infinity,
  });

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {me?.impersonated_by_admin_id && (
        <div className="flex h-9 shrink-0 items-center justify-center gap-3 bg-warning px-4 text-sm font-medium text-warning-foreground">
          <span>You are viewing this workspace as a MaterialOS support session.</span>
          <button type="button" onClick={handleLogout} className="underline underline-offset-2">
            End session
          </button>
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
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
              <div className="flex items-center gap-2 min-w-0">
                {tenantLogoUrl && (
                  <img
                    src={tenantLogoUrl}
                    alt={tenantSettings?.name ?? "Brand logo"}
                    className="h-6 w-6 rounded object-contain border border-border/40 p-0.5 bg-card shrink-0"
                  />
                )}
                <span className="truncate text-sm font-medium text-foreground">
                  {tenantSettings?.name || tenantSlug}
                </span>
                {tenantSettings?.name && tenantSlug && (
                  <span className="hidden text-xs text-muted-foreground lg:inline">({tenantSlug})</span>
                )}
              </div>
            </div>

            {/* Live Status Beacon */}
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground text-[11px]">Real-time sync</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCommandPalette(true)}
                className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs sm:inline">Ctrl K</kbd>
              </button>
              <DensityToggle />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setKeyboardModalOpen(true)}
                aria-label="Keyboard Shortcuts"
                title="Keyboard Shortcuts (?)"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Keyboard className="h-4 w-4" aria-hidden="true" />
              </button>
              {/* ADR-048: Support lives here, globally, instead of a
                  Settings category or a separate sidebar item -- one
                  place, reachable from anywhere. */}
              <Link
                to="/support"
                aria-label="Support"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              </Link>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <OnboardingTourCard tenantLogoUrl={tenantLogoUrl} />
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
      <KeyboardShortcutsModal open={keyboardModalOpen} onOpenChange={setKeyboardModalOpen} />
      <CommandPalette />
      <DesktopUpdateNotifier />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "rounded-lg border border-border bg-card text-card-foreground shadow-md",
            title: "text-sm font-medium",
            description: "text-sm text-muted-foreground",
          },
        }}
      />
    </div>
  );
}
