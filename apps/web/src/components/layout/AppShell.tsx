import { useState } from "react";
import { Keyboard, LifeBuoy, Menu, Search, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { CommandPalette } from "@/components/CommandPalette";
import { DesktopUpdateNotifier } from "@/components/DesktopUpdateNotifier";
import { AiCopilotHud } from "@/components/layout/AiCopilotHud";
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
import { useAiCopilotStore } from "@/store/aiCopilot";
import { useAuthStore } from "@/store/auth";
import { useCommandPaletteStore } from "@/store/commandPalette";
import { useSidebarStore } from "@/store/sidebar";

import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export function AppShell({ children }: { children?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const [keyboardModalOpen, setKeyboardModalOpen] = useState(false);
  const clearSession = useAuthStore((s) => s.clearSession);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const openCommandPalette = useCommandPaletteStore((s) => s.setOpen);
  const openCopilot = useAiCopilotStore((s) => s.openCopilot);
  const { isMobile, isTablet } = useBreakpoint();

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
    <div className="flex h-screen w-full flex-col overflow-x-hidden">
      {me?.impersonated_by_admin_id && (
        <div className="flex h-9 shrink-0 items-center justify-center gap-3 bg-warning px-4 text-xs sm:text-sm font-medium text-warning-foreground">
          <span className="truncate">Viewing as MaterialOS support session.</span>
          <button type="button" onClick={handleLogout} className="underline underline-offset-2 shrink-0">
            End session
          </button>
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {/* Desktop/tablet sidebar (>=768px) -- collapsible to an icon-only rail.
            Below that, navigation lives entirely in the MobileDrawer & BottomNavBar. */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col bg-brand-navy text-brand-navy-foreground transition-[width] duration-200 ease-in-out md:flex",
            collapsed || isTablet ? "w-[68px]" : "w-60"
          )}
        >
          <SidebarHeader collapsed={collapsed || isTablet} onToggleCollapse={toggleCollapsed} />
          <SidebarNav collapsed={collapsed || isTablet} />
          <SidebarFooter collapsed={collapsed || isTablet} onLogout={handleLogout} />
        </aside>

        <MobileDrawer />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-4 md:px-6 pt-safe">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden active:scale-95"
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
                <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                  {tenantSettings?.name || tenantSlug}
                </span>
                {tenantSettings?.name && tenantSlug && (
                  <span className="hidden text-xs text-muted-foreground lg:inline">({tenantSlug})</span>
                )}
              </div>
            </div>

            {/* Live Status Beacon */}
            <div className="hidden xl:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground text-[11px]">Real-time sync</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => openCopilot()}
                aria-label="AI Copilot"
                className="relative flex h-8 sm:h-9 items-center gap-1.5 sm:gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 sm:px-3 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all shadow-[0_0_15px_rgba(124,58,237,0.15)] active:scale-95"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                </span>
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="hidden sm:inline font-medium">AI Copilot</span>
                <kbd className="hidden rounded border border-violet-500/30 bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-mono text-violet-300 md:inline">Ctrl J</kbd>
              </button>
              <button
                type="button"
                onClick={() => openCommandPalette(true)}
                aria-label="Search"
                className="flex h-8 sm:h-9 items-center gap-1.5 sm:gap-2 rounded-md border border-input px-2 sm:px-3 text-xs sm:text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-95"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-mono md:inline">Ctrl K</kbd>
              </button>
              <div className="hidden sm:flex items-center gap-1.5">
                <DensityToggle />
              </div>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setKeyboardModalOpen(true)}
                aria-label="Keyboard Shortcuts"
                title="Keyboard Shortcuts (?)"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Keyboard className="h-4 w-4" aria-hidden="true" />
              </button>
              {/* Support */}
              <Link
                to="/support"
                aria-label="Support"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              </Link>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
            <OnboardingTourCard tenantLogoUrl={tenantLogoUrl} />
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (<768px) */}
      <BottomNavBar />

      <KeyboardShortcutsModal open={keyboardModalOpen} onOpenChange={setKeyboardModalOpen} />
      <AiCopilotHud />
      <CommandPalette />
      <DesktopUpdateNotifier />
      <Toaster
        position={isMobile ? "top-center" : "bottom-right"}
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

