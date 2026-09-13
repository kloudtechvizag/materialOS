import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MEDIA_QUERY).matches;
}

/** Applies (or removes) Tailwind's "dark" class on <html> -- the single
 * place light vs dark is ever decided. Called on store init, on every
 * setMode, and (only while mode === "system") on OS theme-change events,
 * so switching the OS theme live-updates the app without a reload. */
function applyMode(mode: ThemeMode) {
  const isDark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => {
        applyMode(mode);
        set({ mode });
      },
    }),
    {
      name: "materialos-theme",
      onRehydrateStorage: () => (state) => {
        // Runs once after localStorage is read back on boot -- default
        // ("system", before any persisted value loads) is applied by
        // initThemeWatcher() below so there's never a flash of the
        // wrong theme while this is still rehydrating.
        if (state) applyMode(state.mode);
      },
    }
  )
);

/** Mounted once at app startup (see main.tsx). Applies the current mode
 * immediately (covers the render before persisted state rehydrates) and
 * subscribes to OS theme changes for as long as mode stays "system". */
export function initThemeWatcher() {
  applyMode(useThemeStore.getState().mode);

  const media = window.matchMedia(MEDIA_QUERY);
  const onChange = () => {
    if (useThemeStore.getState().mode === "system") applyMode("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
