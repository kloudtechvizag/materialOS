import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface IndustryProfile {
  id: string;
  slug: string;
  name: string;
  category: string;
  terminology: Record<string, string>;
  enabled_modules: string[];
  navigation_config: unknown[];
  dashboard_widgets: string[];
  inventory_flags: Record<string, boolean>;
  pricing_strategy: string;
}

interface CompanyWithProfile {
  id: string;
  industry_profile: IndustryProfile | null;
}

/** Single-company-per-tenant assumption already baked into
 * CompanySettingsPage (`companies[0]`) -- reused here rather than adding
 * a second one. Shares the `["companies"]` query cache with that page
 * instead of issuing a second /companies fetch.
 *
 * No separate React Context: TanStack Query's cache is already the
 * shared-state mechanism every caller of this hook gets for free, so a
 * Provider would just be a second layer over the same data. */
export function useIndustryProfile() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const query = useQuery({
    queryKey: ["companies"],
    queryFn: () => apiFetch<CompanyWithProfile[]>("/companies"),
    enabled: !!tenantSlug,
  });

  return {
    profile: query.data?.[0]?.industry_profile ?? null,
    isLoading: query.isLoading,
  };
}
