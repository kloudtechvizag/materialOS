import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useIndustryProfile } from "@/lib/industryProfile";

interface IndustryProfileOption {
  slug: string;
  name: string;
}

/** IndustryProfile viewer + switcher (ADR-010). Switching is a single
 * FK write on Company -- the sidebar/dashboard/item form all read the
 * profile live via useIndustryProfile(), so invalidating the shared
 * ["companies"] query is the entire client-side effect. No data is
 * touched: existing items/customers/etc. are unaffected, only which
 * modules/widgets/terminology are shown. Per-company overrides beyond
 * the profile default are still deferred -- this switches the whole
 * profile, it doesn't let you tweak one module in isolation. */
export function IndustryConfigPage() {
  const queryClient = useQueryClient();
  const { profile, companyId, isLoading } = useIndustryProfile();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: industries } = useQuery({
    queryKey: ["industry-profiles"],
    queryFn: () => apiFetch<IndustryProfileOption[]>("/industry-profiles", { auth: false }),
  });

  const switchProfile = useMutation({
    mutationFn: (industry_slug: string) =>
      apiFetch(`/companies/${companyId}/industry-profile`, { method: "PATCH", body: { industry_slug } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSelected(null);
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!profile) return null;

  const pendingSlug = selected ?? profile.slug;
  const isChanged = pendingSlug !== profile.slug;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Industry configuration</h1>
        <p className="text-sm text-muted-foreground">
          {profile.name} · determines your sidebar, dashboard, and item fields.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Industry profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="industry-select">Active profile</Label>
            <select
              id="industry-select"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pendingSlug}
              onChange={(e) => setSelected(e.target.value)}
            >
              {(industries ?? [{ slug: profile.slug, name: profile.name }]).map((i) => (
                <option key={i.slug} value={i.slug}>{i.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Switches which modules, dashboard widgets, and terminology are shown -- immediately, everywhere in the
            app. No items, customers, or transactions are changed or deleted.
          </p>
          {switchProfile.isError && <ErrorState error={switchProfile.error} />}
          <Button
            disabled={!isChanged || switchProfile.isPending}
            onClick={() => switchProfile.mutate(pendingSlug)}
          >
            {switchProfile.isPending ? "Switching..." : "Switch profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Enabled modules</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {profile.enabled_modules.map((m) => (
            <Badge key={m} variant="outline" className="capitalize">{m.replace(/_/g, " ")}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Inventory model</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(profile.inventory_flags).map(([flag, enabled]) => (
            <div key={flag} className="flex items-center justify-between text-sm">
              <span className="capitalize text-muted-foreground">{flag.replace(/_/g, " ")}</span>
              <Badge variant={enabled ? "default" : "outline"}>{enabled ? "On" : "Off"}</Badge>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">Pricing strategy</span>
            <span className="font-medium capitalize">{profile.pricing_strategy.replace(/_/g, " ")}</span>
          </div>
        </CardContent>
      </Card>

      {Object.keys(profile.terminology).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Terminology</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(profile.terminology).map(([term, label]) => (
              <div key={term} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{term}</span>
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
