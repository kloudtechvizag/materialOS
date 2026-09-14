import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Deliberately separate from useAuthStore, with its own persisted key
 * ("materialos-platform-auth" vs "materialos-auth") -- a platform admin
 * token and a tenant user's token must never share storage, the same
 * separation the backend enforces via a distinct JWT type (ADR-020). */
interface PlatformAuthState {
  accessToken: string | null;
  setToken: (accessToken: string) => void;
  clearToken: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      setToken: (accessToken) => set({ accessToken }),
      clearToken: () => set({ accessToken: null }),
    }),
    { name: "materialos-platform-auth" }
  )
);
