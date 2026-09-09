import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Package, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useSubscription } from "@/lib/subscription";

interface FeatureOut { code: string; name: string; category: string; description: string | null }
interface AddonOfferingOut {
  id: string; code: string; name: string; description: string | null; category: string;
  feature_code: string | null; limit_key: string | null; limit_delta: number | null;
  monthly_price: string; yearly_price: string;
}
interface SubscriptionAddonOut {
  id: string; addon_offering_id: string | null; code: string; name: string;
  feature_id: string | null; limit_key: string | null; limit_delta: number | null;
  price: string; billing_cycle: string; is_active: boolean;
}
interface SubscriptionInvoice { id: string; invoice_number: string; total: string; currency: string }
interface CheckoutOut { payment: { id: string }; order_id: string; amount: number; currency: string; is_sandbox: boolean }

/** Settings -> Capabilities: the master-prompt's "capability marketplace"
 * gap. IndustryProfile.enabled_modules (see lib/navigation.ts) already
 * turns whole nav sections on/off per industry -- this is the other,
 * per-tenant half: browsing the real Feature/AddonOffering catalog
 * (services/entitlements.py, services/billing_plans.py) and installing
 * one, which purchases a real SubscriptionAddon and grants has_feature()
 * immediately. Reuses the exact checkout/simulate flow SubscriptionPage
 * already uses for plan changes -- no second payment path. */
export function CapabilityMarketplacePage() {
  const queryClient = useQueryClient();
  const [pendingInvoice, setPendingInvoice] = useState<SubscriptionInvoice | null>(null);
  const [checkout, setCheckout] = useState<CheckoutOut | null>(null);

  const { data: subscription, isLoading: subLoading, error: subError } = useSubscription();
  const { data: features, isLoading: featuresLoading, error: featuresError } = useQuery({
    queryKey: ["pricing-features"], queryFn: () => apiFetch<FeatureOut[]>("/pricing/features"),
  });
  const { data: offerings } = useQuery({
    queryKey: ["pricing-addons"], queryFn: () => apiFetch<AddonOfferingOut[]>("/pricing/addons"),
  });
  const { data: activeAddons } = useQuery({
    queryKey: ["subscription-addons"], queryFn: () => apiFetch<SubscriptionAddonOut[]>("/subscription/addons"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-addons"] });
  }

  const purchase = useMutation({
    mutationFn: (addonOfferingId: string) =>
      apiFetch<{ addon: SubscriptionAddonOut; invoice: SubscriptionInvoice }>("/subscription/addons", {
        method: "POST", body: { addon_offering_id: addonOfferingId, billing_cycle: subscription?.billing_cycle ?? "yearly" },
      }),
    onSuccess: (data) => {
      invalidateAll();
      setPendingInvoice(data.invoice);
    },
  });

  const cancelAddon = useMutation({
    mutationFn: (addonId: string) => apiFetch(`/subscription/addons/${addonId}/cancel`, { method: "POST" }),
    onSuccess: invalidateAll,
  });

  const startCheckout = useMutation({
    mutationFn: (invoiceId: string) => apiFetch<CheckoutOut>("/billing/checkout", { method: "POST", body: { invoice_id: invoiceId } }),
    onSuccess: (data) => setCheckout(data),
  });

  const simulate = useMutation({
    mutationFn: (succeed: boolean) => apiFetch(`/billing/checkout/${checkout?.payment.id}/simulate`, { method: "POST", body: { succeed } }),
    onSuccess: () => {
      invalidateAll();
      setPendingInvoice(null);
      setCheckout(null);
    },
  });

  if (subLoading || featuresLoading) return <Skeleton className="h-96" />;
  if (subError) return <ErrorState error={subError} />;
  if (featuresError) return <ErrorState error={featuresError} />;
  if (!subscription || !features) return null;

  const includedCodes = new Set(subscription.plan.features);
  const activeByFeatureId = new Map((activeAddons ?? []).filter((a) => a.feature_id).map((a) => [a.feature_id as string, a]));
  const offeringByFeatureCode = new Map((offerings ?? []).filter((o) => o.feature_code).map((o) => [o.feature_code as string, o]));

  const byCategory = new Map<string, FeatureOut[]>();
  for (const f of features) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Capabilities</h1>
        <p className="text-sm text-muted-foreground">Every module MaterialOS can turn on for your workspace -- what's included in {subscription.plan.name}, and what you can install.</p>
      </div>

      {pendingInvoice && !checkout && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm">Invoice {pendingInvoice.invoice_number} -- {pendingInvoice.currency} {pendingInvoice.total} due to activate this add-on.</span>
            <Button size="sm" onClick={() => startCheckout.mutate(pendingInvoice.id)} disabled={startCheckout.isPending}>Pay now</Button>
          </CardContent>
        </Card>
      )}
      {checkout && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-2 py-4">
            <p className="text-sm">Order {checkout.order_id} -- ₹{(checkout.amount / 100).toLocaleString("en-IN")}{checkout.is_sandbox && " (sandbox: no real gateway configured, simulate the result below)"}</p>
            {checkout.is_sandbox && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => simulate.mutate(true)} disabled={simulate.isPending}>Simulate success</Button>
                <Button size="sm" variant="outline" onClick={() => simulate.mutate(false)} disabled={simulate.isPending}>Simulate failure</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {[...byCategory.entries()].map(([category, categoryFeatures]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryFeatures.map((f) => {
              const included = includedCodes.has(f.code);
              const activeAddon = activeByFeatureId.get(f.code);
              const offering = offeringByFeatureCode.get(f.code);
              return (
                <Card key={f.code}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{f.name}</CardTitle>
                      {included && <Badge variant="success"><Check className="mr-1 h-3 w-3" />Included</Badge>}
                      {!included && activeAddon && <Badge variant="secondary"><Package className="mr-1 h-3 w-3" />Active</Badge>}
                      {!included && !activeAddon && offering && <Badge variant="outline">Available</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                    {!included && !activeAddon && offering && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          ₹{Number(subscription.billing_cycle === "monthly" ? offering.monthly_price : offering.yearly_price).toLocaleString("en-IN")}/{subscription.billing_cycle === "monthly" ? "mo" : "yr"}
                        </span>
                        <Button size="sm" onClick={() => purchase.mutate(offering.id)} disabled={purchase.isPending}>Install</Button>
                      </div>
                    )}
                    {!included && activeAddon && (
                      <Button size="sm" variant="outline" onClick={() => cancelAddon.mutate(activeAddon.id)} disabled={cancelAddon.isPending}>Remove</Button>
                    )}
                    {!included && !activeAddon && !offering && (
                      <span className="text-xs text-muted-foreground">Not available as an add-on yet.</span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {features.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Store className="mb-2 h-8 w-8" />
          <p>No capabilities in the catalog yet.</p>
        </div>
      )}
    </div>
  );
}
