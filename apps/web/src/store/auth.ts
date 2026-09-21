import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  tenantSlug: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  customerId: string | null;
  guardianId: string | null;
  /** Survives clearSession (logout) so the login screen can greet a
   * returning user by workspace instead of asking them to retype it
   * every time. Never used for authorization -- purely a UI prefill. */
  lastTenantSlug: string | null;
  setSession: (args: { tenantSlug: string; accessToken: string; refreshToken: string; customerId?: string | null; guardianId?: string | null }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tenantSlug: null,
      accessToken: null,
      refreshToken: null,
      customerId: null,
      guardianId: null,
      lastTenantSlug: null,
      setSession: ({ tenantSlug, accessToken, refreshToken, customerId = null, guardianId = null }) =>
        set({ tenantSlug, accessToken, refreshToken, customerId, guardianId, lastTenantSlug: tenantSlug }),
      clearSession: () => set({ tenantSlug: null, accessToken: null, refreshToken: null, customerId: null, guardianId: null }),
    }),
    { name: "materialos-auth" }
  )
);
