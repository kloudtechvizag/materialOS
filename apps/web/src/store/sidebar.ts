import { create } from "zustand";
import { persist } from "zustand/middleware";

import { NAVIGATION_CONFIG } from "@/lib/navigation";

interface SidebarState {
  /** Global icon-only collapse (desktop only -- mobile always uses the drawer). */
  collapsed: boolean;
  /** Per-section expand/collapse, keyed by NavigationSection.id. */
  expandedSections: Record<string, boolean>;
  /** Mobile drawer open state -- not persisted, always closed on load. */
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleSection: (id: string) => void;
  expandSection: (id: string) => void;
  setMobileOpen: (open: boolean) => void;
}

const DEFAULT_EXPANDED: Record<string, boolean> = Object.fromEntries(
  NAVIGATION_CONFIG.map((section) => [section.id, true])
);

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      expandedSections: DEFAULT_EXPANDED,
      mobileOpen: false,
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleSection: (id) => set({ expandedSections: { ...get().expandedSections, [id]: !get().expandedSections[id] } }),
      expandSection: (id) => {
        if (get().expandedSections[id]) return;
        set({ expandedSections: { ...get().expandedSections, [id]: true } });
      },
      setMobileOpen: (open) => set({ mobileOpen: open }),
    }),
    {
      // One persisted key covering both the collapse flag and per-section
      // state -- functionally the same as separate
      // materialos.sidebar.collapsed / materialos.sidebar.sections keys,
      // just consistent with how useAuthStore already persists ("materialos-auth").
      name: "materialos-sidebar",
      partialize: (state) => ({ collapsed: state.collapsed, expandedSections: state.expandedSections }),
    }
  )
);
