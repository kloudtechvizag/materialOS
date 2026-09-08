import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHasFeature } from "@/lib/subscription";

interface FeatureGateProps {
  feature: string;
  title: string;
  description: string;
  requiredPlan?: string;
  children: ReactNode;
}

/** spec sec55-56: a locked feature explains itself and offers an
 * upgrade path -- never a bare "Access Denied". Client-side only (a UI
 * hint, per useHasFeature's own caveat) -- the actual enforcement is
 * the backend's require_feature() dependency on the endpoint itself. */
export function FeatureGate({ feature, title, description, requiredPlan, children }: FeatureGateProps) {
  const hasFeature = useHasFeature(feature);

  if (hasFeature) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {requiredPlan && (
        <p className="text-xs text-muted-foreground">Available in the {requiredPlan} plan and above.</p>
      )}
      <div className="flex gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to="/pricing">Compare plans</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/settings/subscription">Upgrade</Link>
        </Button>
      </div>
    </div>
  );
}
