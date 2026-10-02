import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Sparkles, Building2, Split, Layers, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useIndustryProfile } from "@/lib/industryProfile";
import { IndustryTransitionModal } from "@/components/settings/IndustryTransitionModal";
import { cn } from "@/lib/utils";

interface IndustryProfileOption {
  slug: string;
  name: string;
}

interface ActivitySummary {
  invoices_count: number;
  orders_count: number;
  items_count: number;
  customers_count: number;
  has_transactions: boolean;
}

export function IndustryConfigPage() {
  const { profile, companyId, companyName, companies, setActiveCompany, isLoading } = useIndustryProfile();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: industries } = useQuery({
    queryKey: ["industry-profiles"],
    queryFn: () => apiFetch<IndustryProfileOption[]>("/industry-profiles", { auth: false }),
  });

  const { data: activitySummary } = useQuery({
    queryKey: ["company-activity-summary", companyId],
    queryFn: () => apiFetch<ActivitySummary>(`/companies/${companyId}/activity-summary`),
    enabled: !!companyId,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!profile) return null;

  const currentSlug = profile.slug;
  const pendingSlug = selectedSlug ?? currentSlug;
  const isChanged = pendingSlug !== currentSlug;
  const hasTransactions = Boolean(activitySummary?.has_transactions);

  function handleInitiateTransition() {
    setIsModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Industry configuration</h1>
          <p className="text-sm text-muted-foreground">
            {profile.name} · determines your sidebar, dashboard, and item fields.
          </p>
        </div>

        {hasTransactions ? (
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 py-1 px-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Active Ledger Safeguard</span>
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs shrink-0"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Clean State</span>
          </Badge>
        )}
      </div>

      {/* Multi-Company Entity Selector if user has multiple companies */}
      {companies.length > 1 && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-500" />
                <CardTitle className="text-sm font-semibold">Workspace Companies ({companies.length})</CardTitle>
              </div>
              <span className="text-[11px] text-muted-foreground">Multi-Company Architecture</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {companies.map((c) => {
                const isActive = c.id === companyId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => !isActive && setActiveCompany(c.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all",
                      isActive
                        ? "border-violet-500 bg-background shadow-xs font-semibold ring-1 ring-violet-500/40 cursor-default"
                        : "border-border/70 hover:border-border bg-card/60 hover:bg-card text-muted-foreground cursor-pointer"
                    )}
                  >
                    <div>
                      <p className="font-semibold text-foreground line-clamp-1">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {c.industry_profile?.name ?? "Building Materials"}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 px-2 py-0.5 text-[9px] font-bold">
                        Active
                      </span>
                    ) : (
                      <span className="text-[11px] text-violet-500 font-medium hover:underline">
                        Switch
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Industry Profile Switcher Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Industry profile</CardTitle>
            {activitySummary && (
              <span className="text-xs text-muted-foreground font-mono">
                {activitySummary.invoices_count} inv · {activitySummary.items_count} items
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="industry-select">Active profile</Label>
            <select
              id="industry-select"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={pendingSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
            >
              {(industries ?? [{ slug: profile.slug, name: profile.name }]).map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name} {i.slug === currentSlug ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 text-xs border border-border/60 text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>Smart Transition & 1-Click Sister Company Protection</span>
            </div>
            <p>
              Switches which modules, dashboard widgets, and terminology are shown. If this company has recorded
              invoices, you can spin off a sister company with 1 click to keep all accounting records 100% intact.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              disabled={!isChanged}
              onClick={handleInitiateTransition}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs"
            >
              <Split className="h-3.5 w-3.5 mr-1.5" />
              {isChanged ? `Transition to ${industries?.find((i) => i.slug === pendingSlug)?.name || pendingSlug}` : "Switch profile"}
            </Button>

            {isChanged && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSlug(null)}
                className="text-xs text-muted-foreground"
              >
                Reset selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enabled Modules Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enabled modules</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {profile.enabled_modules.map((m) => (
            <Badge key={m} variant="outline" className="capitalize">
              {m.replace(/_/g, " ")}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Inventory Model Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory model</CardTitle>
        </CardHeader>
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

      {/* Terminology Card */}
      {Object.keys(profile.terminology).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terminology</CardTitle>
          </CardHeader>
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

      {/* Smart Intent Discovery & Sister Company Fork Modal */}
      {isChanged && companyId && companyName && (
        <IndustryTransitionModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          currentProfile={profile}
          targetProfileSlug={pendingSlug}
          companyId={companyId}
          companyName={companyName}
          industries={industries ?? []}
          activitySummary={activitySummary}
          onSuccess={(newCompanyId) => {
            setSelectedSlug(null);
            if (newCompanyId) {
              setActiveCompany(newCompanyId);
            }
          }}
        />
      )}
    </div>
  );
}
