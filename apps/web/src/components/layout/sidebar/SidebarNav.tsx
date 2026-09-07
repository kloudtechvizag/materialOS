import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { SidebarSection } from "@/components/layout/sidebar/SidebarSection";
import { NAVIGATION_CONFIG, findActiveSectionId } from "@/lib/navigation";
import { useSidebarStore } from "@/store/sidebar";

/** The single navigation renderer -- the desktop sidebar (expanded and
 * icon-only) and the mobile drawer all mount this, so route/label changes
 * only ever happen in one place. */
export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const expandedSections = useSidebarStore((s) => s.expandedSections);
  const toggleSection = useSidebarStore((s) => s.toggleSection);
  const expandSection = useSidebarStore((s) => s.expandSection);

  // Never leave the active route buried in a collapsed section -- direct
  // URL navigation, browser back/forward, and in-app links all land here.
  useEffect(() => {
    const activeId = findActiveSectionId(location.pathname);
    if (activeId) expandSection(activeId);
  }, [location.pathname, expandSection]);

  return (
    <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto p-3">
      {NAVIGATION_CONFIG.map((section) => (
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
