import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

export interface PlanOut {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string | null;
  tier_order: number;
  is_public: boolean;
  is_default_signup_plan: boolean;
  currency: string;
  monthly_price: string | null;
  yearly_price: string | null;
  trial_days: number;
  features: string[];
  limits: Record<string, number | null>;
}

export interface SubscriptionOut {
  id: string;
  plan: PlanOut;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

/** ADR-014: the frontend's hasFeature() -- reads the same plan.features
 * list the backend's require_feature() dependency checks, so a
 * <FeatureGate/> and its server-side enforcement never disagree. */
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => apiFetch<SubscriptionOut>("/subscription"),
    staleTime: 30_000,
  });
}

/** Reads only the base plan's grants -- a feature unlocked purely via a
 * SubscriptionAddon (spec sec21) isn't reflected here yet, so a
 * frontend gate can show "locked" for something the backend would
 * actually allow. The server-side require_feature() check (which does
 * account for addons) is always the source of truth; this is a UI hint. */
export function useHasFeature(featureCode: string): boolean {
  const { data } = useSubscription();
  if (!data) return false;
  const entitledStatuses = ["trialing", "active", "past_due", "grace_period"];
  if (!entitledStatuses.includes(data.status)) return false;
  return data.plan.features.includes(featureCode);
}
