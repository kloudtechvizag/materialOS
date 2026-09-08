import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIndustryProfile } from "@/lib/industryProfile";

/** Read-only view of the active IndustryProfile (ADR-010). Editing --
 * per-company overrides beyond the profile default, or switching
 * profiles after signup -- is explicitly deferred; this phase ships
 * visibility, not configuration. */
export function IndustryConfigPage() {
  const { profile, isLoading } = useIndustryProfile();

  if (isLoading) return <Skeleton className="h-64" />;
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Industry configuration</h1>
        <p className="text-sm text-muted-foreground">
          {profile.name} · determines your sidebar, dashboard, and item fields. Changing profiles isn't available yet.
        </p>
      </div>

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
