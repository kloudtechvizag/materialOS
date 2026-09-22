import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";

interface Plan {
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
  is_current: boolean;
  is_active: boolean;
}

interface Feature {
  code: string;
  name: string;
  category: string;
  description: string | null;
}

const LIMIT_KEYS = [
  "users", "companies", "branches", "warehouses", "customers", "suppliers", "items",
  "invoices_per_month", "purchase_orders_per_month", "sales_orders_per_month",
  "api_calls_per_month", "storage_gb", "ai_requests_per_month",
];

interface FormState {
  slug: string;
  name: string;
  description: string;
  tier_order: string;
  monthly_price: string;
  yearly_price: string;
  trial_days: string;
  is_public: boolean;
  is_default_signup_plan: boolean;
  feature_codes: Set<string>;
  limits: Record<string, string>;
}

function emptyForm(): FormState {
  return {
    slug: "", name: "", description: "", tier_order: "0", monthly_price: "", yearly_price: "", trial_days: "0",
    is_public: true, is_default_signup_plan: false, feature_codes: new Set(), limits: {},
  };
}

function formFromPlan(plan: Plan): FormState {
  return {
    slug: plan.slug, name: plan.name, description: plan.description ?? "", tier_order: String(plan.tier_order),
    monthly_price: plan.monthly_price ?? "", yearly_price: plan.yearly_price ?? "", trial_days: String(plan.trial_days),
    is_public: plan.is_public, is_default_signup_plan: plan.is_default_signup_plan,
    feature_codes: new Set(plan.features),
    limits: Object.fromEntries(Object.entries(plan.limits).map(([k, v]) => [k, v === null ? "" : String(v)])),
  };
}

export function PlatformPlansPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);

  const { data: plans, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformFetch<Plan[]>("/platform/plans"),
  });
  const { data: features } = useQuery({
    queryKey: ["platform-features"],
    queryFn: () => platformFetch<Feature[]>("/platform/features"),
  });

  const currentPlans = useMemo(
    () => (plans ?? []).filter((p) => p.is_current).sort((a, b) => a.tier_order - b.tier_order),
    [plans]
  );
  const olderVersionsBySlug = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const p of plans ?? []) {
      if (p.is_current) continue;
      map.set(p.slug, [...(map.get(p.slug) ?? []), p]);
    }
    return map;
  }, [plans]);

  const createVersion = useMutation({
    mutationFn: (form: FormState) =>
      platformFetch<Plan>("/platform/plans", {
        method: "POST",
        body: {
          slug: form.slug,
          name: form.name,
          description: form.description || null,
          tier_order: Number(form.tier_order),
          is_public: form.is_public,
          is_default_signup_plan: form.is_default_signup_plan,
          monthly_price: form.monthly_price || null,
          yearly_price: form.yearly_price || null,
          trial_days: Number(form.trial_days),
          feature_codes: [...form.feature_codes],
          limits: Object.fromEntries(
            Object.entries(form.limits).map(([k, v]) => [k, v.trim() === "" ? null : Number(v)])
          ),
        },
      }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
    },
  });

  function toggleFeature(code: string) {
    setEditing((f) => {
      if (!f) return f;
      const next = new Set(f.feature_codes);
      if (next.has(code)) next.delete(code); else next.add(code);
      return { ...f, feature_codes: next };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="mt-1 text-sm text-white/60">A plan is never edited in place -- every change is a new version.</p>
        </div>
        <Button onClick={() => setEditing(emptyForm())}>New plan</Button>
      </div>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {currentPlans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentPlans.map((plan) => (
            <div key={plan.id} className="rounded-xl bg-white p-4 text-foreground">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.slug} &middot; v{plan.version}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {plan.is_default_signup_plan && <Badge variant="secondary">Default signup</Badge>}
                  {!plan.is_public && <Badge variant="outline">Private</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm">
                {plan.monthly_price ? `${plan.currency} ${plan.monthly_price}/mo` : "Custom pricing"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{plan.features.length} features enabled</p>
              {olderVersionsBySlug.has(plan.slug) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {olderVersionsBySlug.get(plan.slug)!.length} earlier version(s) preserved, unchanged
                </p>
              )}
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setEditing(formFromPlan(plan))}>
                Create new version
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.slug ? `New version of ${editing.slug}` : "New plan"}</DialogTitle>
            <DialogDescription>
              This creates a brand-new plan row. Existing subscribers on the current version are completely unaffected.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="growth" />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Growth" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tier order</Label>
                  <Input type="number" value={editing.tier_order} onChange={(e) => setEditing({ ...editing, tier_order: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Trial days</Label>
                  <Input type="number" value={editing.trial_days} onChange={(e) => setEditing({ ...editing, trial_days: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly price (INR)</Label>
                  <Input value={editing.monthly_price} onChange={(e) => setEditing({ ...editing, monthly_price: e.target.value })} placeholder="1999.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Yearly price (INR)</Label>
                  <Input value={editing.yearly_price} onChange={(e) => setEditing({ ...editing, yearly_price: e.target.value })} placeholder="19190.00" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Description</Label>
                  <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.is_public} onCheckedChange={(v) => setEditing({ ...editing, is_public: v === true })} />
                  Public (self-serve checkout)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.is_default_signup_plan} onCheckedChange={(v) => setEditing({ ...editing, is_default_signup_plan: v === true })} />
                  Default signup plan
                </label>
              </div>

              <div>
                <Label>Limits (blank = unlimited)</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LIMIT_KEYS.map((key) => (
                    <div key={key} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{key}</p>
                      <Input
                        value={editing.limits[key] ?? ""}
                        onChange={(e) => setEditing({ ...editing, limits: { ...editing.limits, [key]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Features</Label>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(features ?? []).map((f) => (
                    <label key={f.code} className="flex items-center gap-2 py-0.5 text-sm">
                      <Checkbox checked={editing.feature_codes.has(f.code)} onCheckedChange={() => toggleFeature(f.code)} />
                      <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {createVersion.isError && <ErrorState error={createVersion.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => editing && createVersion.mutate(editing)}
              disabled={!editing?.slug || !editing?.name || createVersion.isPending}
            >
              {createVersion.isPending ? "Saving..." : "Save new version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
