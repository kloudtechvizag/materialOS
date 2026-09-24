import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { SidebarItem } from "@/components/layout/sidebar/SidebarItem";
import { SidebarSection } from "@/components/layout/sidebar/SidebarSection";
import { apiFetch } from "@/lib/api";
import { buildGlobalNavItems, buildNavigation, findActiveSectionId } from "@/lib/navigation";
import { useIndustryProfile } from "@/lib/industryProfile";
import { useSidebarStore } from "@/store/sidebar";

interface CurrentUserPermissions {
  permissions: string[];
}

/** The single navigation renderer -- the desktop sidebar (expanded and
 * icon-only) and the mobile drawer all mount this, so route/label changes
 * only ever happen in one place. Filters to the current company's
 * industry profile (ADR-010) and, real as of ADR-047, the current
 * user's own real permissions (`item.permission`, previously declared
 * but never enforced); while either is still loading, buildNavigation
 * shows everything gated by that dimension rather than flashing an
 * empty sidebar.
 *
 * Dashboard and Approvals render flat, above every module section and
 * outside any accordion -- they're global to every business profile,
 * not a "Sell" capability, so they're never nested inside a collapsible
 * section (see GLOBAL_NAV_ITEMS in lib/navigation.ts). */
export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { profile } = useIndustryProfile();
  // Shares AppShell's own /auth/me cache (identical queryKey +
  // staleTime) -- one call for the whole app, not a second one just
  // for nav permission filtering.
  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiFetch<CurrentUserPermissions>("/auth/me"),
    staleTime: Infinity,
  });
  const globalItems = useMemo(() => buildGlobalNavItems(profile?.enabled_modules), [profile]);
  const sections = useMemo(
    () => buildNavigation(profile?.enabled_modules, profile?.terminology, me?.permissions),
    [profile, me]
  );
  const expandedSections = useSidebarStore((s) => s.expandedSections);
  const toggleSection = useSidebarStore((s) => s.toggleSection);
  const expandSection = useSidebarStore((s) => s.expandSection);

  // Never leave the active route buried in a collapsed section -- direct
  // URL navigation, browser back/forward, and in-app links all land here.
  useEffect(() => {
    const activeId = findActiveSectionId(location.pathname, sections);
    if (activeId) expandSection(activeId);
  }, [location.pathname, sections, expandSection]);

  return (
    <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto p-3">
      <div className="space-y-0.5">
        {globalItems.map((item) => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
      {sections.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          expanded={collapsed ? true : (expandedSections[section.id] ?? true)}
          onToggle={() => toggleSection(section.id)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
