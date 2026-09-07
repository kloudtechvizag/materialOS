import { ChevronDown, ChevronRight } from "lucide-react";

import { SidebarItem } from "@/components/layout/sidebar/SidebarItem";
import type { NavigationSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarSection({
  section,
  expanded,
  onToggle,
  collapsed,
  onNavigate,
}: {
  section: NavigationSection;
  expanded: boolean;
  onToggle: () => void;
  /** Global icon-only collapse -- when true, section grouping disappears
   * entirely and items render as a flat icon list (no header, no chevron). */
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="space-y-1">
        {section.items.map((item) => (
          <SidebarItem key={item.id} item={item} collapsed onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  const panelId = `sidebar-section-${section.id}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex h-8 w-full items-center justify-between rounded-md px-3 text-xs font-semibold uppercase tracking-wide text-brand-navy-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        <span>{section.label}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <div
        id={panelId}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 space-y-0.5 pt-1">
          {section.items.map((item) => (
            <SidebarItem key={item.id} item={item} collapsed={false} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}
