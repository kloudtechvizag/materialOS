import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { SidebarSection } from "@/components/layout/sidebar/SidebarSection";
import { buildNavigation, findActiveSectionId } from "@/lib/navigation";
import { useIndustryProfile } from "@/lib/industryProfile";
import { useSidebarStore } from "@/store/sidebar";

/** The single navigation renderer -- the desktop sidebar (expanded and
 * icon-only) and the mobile drawer all mount this, so route/label changes
 * only ever happen in one place. Filters to the current company's
 * industry profile (ADR-010); while the profile is still loading,
 * buildNavigation(undefined) shows everything rather than flashing an
 * empty sidebar. */
export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { profile } = useIndustryProfile();
  const sections = useMemo(() => buildNavigation(profile?.enabled_modules), [profile]);
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
