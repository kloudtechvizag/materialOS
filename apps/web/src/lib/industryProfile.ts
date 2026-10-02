import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface GoldenWorkflow {
  cta_label: string;
  cta_href: string;
  steps: string[];
}

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
  /** {} means "no profile-specific override -- use the generic
   * quotation flow" (DashboardPage's DEFAULT_GOLDEN_WORKFLOW), NOT
   * "show nothing" the way an empty dashboard_widgets list means for
   * laboratory. Deliberately different semantics for this field. */
  golden_workflow: Partial<GoldenWorkflow>;
}

interface CompanyWithProfile {
  id: string;
  name: string;
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

  const activeId = typeof window !== "undefined" ? localStorage.getItem("materialos_active_company_id") : null;
  const activeCompany = (query.data && query.data.find((c) => c.id === activeId)) || query.data?.[0];

  const setActiveCompany = (companyId: string) => {
    localStorage.setItem("materialos_active_company_id", companyId);
    window.location.reload();
  };

  return {
    profile: activeCompany?.industry_profile ?? null,
    companyId: activeCompany?.id ?? null,
    companyName: activeCompany?.name ?? null,
    companies: query.data ?? [],
    setActiveCompany,
    isLoading: query.isLoading,
  };
}
