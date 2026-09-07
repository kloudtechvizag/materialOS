import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  tenantSlug: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  customerId: string | null;
  setSession: (args: { tenantSlug: string; accessToken: string; refreshToken: string; customerId?: string | null }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tenantSlug: null,
      accessToken: null,
      refreshToken: null,
      customerId: null,
      setSession: ({ tenantSlug, accessToken, refreshToken, customerId = null }) =>
        set({ tenantSlug, accessToken, refreshToken, customerId }),
      clearSession: () => set({ tenantSlug: null, accessToken: null, refreshToken: null, customerId: null }),
    }),
    { name: "materialos-auth" }
  )
);
