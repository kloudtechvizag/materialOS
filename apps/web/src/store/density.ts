import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact";

interface DensityState {
  density: Density;
  setDensity: (density: Density) => void;
}

/** Sets "data-density" on <html> -- index.css's --control-h/--table-cell-py
 * tokens (consumed by Button, Input, and every table's td/th) key off
 * this attribute. Unlike theme there's no "system" option: density is a
 * pure user preference with no OS signal to follow. */
function applyDensity(density: Density) {
  document.documentElement.setAttribute("data-density", density);
}

export const useDensityStore = create<DensityState>()(
  persist(
    (set) => ({
      density: "comfortable",
      setDensity: (density) => {
        applyDensity(density);
        set({ density });
      },
    }),
    {
      name: "materialos-density",
      onRehydrateStorage: () => (state) => {
        if (state) applyDensity(state.density);
      },
    }
  )
);

/** Mounted once at app startup (see main.tsx), alongside initThemeWatcher --
 * applies the current density immediately so there's no flash of the
 * wrong control size before persisted state rehydrates. */
export function initDensityWatcher() {
  applyDensity(useDensityStore.getState().density);
}
