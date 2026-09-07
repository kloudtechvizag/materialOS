import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  tenantSlug: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (args: { tenantSlug: string; accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tenantSlug: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ tenantSlug, accessToken, refreshToken }) =>
        set({ tenantSlug, accessToken, refreshToken }),
      clearSession: () => set({ tenantSlug: null, accessToken: null, refreshToken: null }),
    }),
    { name: "materialos-auth" }
  )
);
