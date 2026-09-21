import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DashboardPrefsState {
  /** Compact-by-default for first-time users (spec's own requirement) --
   * the Recent Activity panel starts collapsed until a user explicitly
   * expands it once, same "remember what the user chose" contract as
   * useSidebarStore's per-section expand state. */
  recentActivityExpanded: boolean;
  setRecentActivityExpanded: (expanded: boolean) => void;
}

export const useDashboardPrefsStore = create<DashboardPrefsState>()(
  persist(
    (set) => ({
      recentActivityExpanded: false,
      setRecentActivityExpanded: (expanded) => set({ recentActivityExpanded: expanded }),
    }),
    {
      // A browser-level preference, not tenant/company-scoped -- same
      // scoping useSidebarStore's own persisted state already has (one
      // browser profile, not one row per tenant this browser has ever
      // logged into). Consistent with the existing convention rather
      // than introducing a new per-tenant-keyed storage shape for just
      // this one preference.
      name: "materialos-dashboard-prefs",
    }
  )
);
