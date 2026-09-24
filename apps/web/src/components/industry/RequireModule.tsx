import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIndustryProfile } from "@/lib/industryProfile";

interface RequireModuleProps {
  /** Module key from IndustryProfile.enabled_modules, e.g. "laboratory". */
  module: string;
  children: ReactNode;
}

/** Route-level counterpart to buildNavigation()'s item filtering
 * (lib/navigation.ts) -- that only hides the sidebar link; it never
 * stopped a user who typed /lab/samples directly, or a bookmark left
 * over from a company that later switched industry profile, from
 * rendering the page. This is still only a UX guard: the real
 * enforcement is the backend's require_module() dependency on the
 * router itself (app/deps.py) -- mirrors FeatureGate's own "client-side
 * hint, backend is the enforcement" split for billing-plan features. */
export function RequireModule({ module, children }: RequireModuleProps) {
  const { profile, isLoading } = useIndustryProfile();

  if (isLoading) return <Skeleton className="h-40" />;

  const enabled = profile?.enabled_modules?.includes(module) ?? false;
  if (enabled) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">This feature isn't enabled for this business</h3>
      <p className="text-sm text-muted-foreground">
        {profile ? `${profile.name} doesn't include this module.` : "No business profile is configured yet."}
      </p>
      <div className="flex gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to="/">Go to dashboard</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/settings/business">Business profile settings</Link>
        </Button>
      </div>
    </div>
  );
}
