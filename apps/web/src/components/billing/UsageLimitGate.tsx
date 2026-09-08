import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface UsageLimitGateProps {
  label: string;
  used: number;
  limit: number;
}

/** spec sec57. Rendered by a caller that already knows it's over the
 * limit (e.g. a create-form disabling its submit button) -- this is
 * the explanatory panel, not the check itself (that's the backend's
 * enforce_quota/enforce_meter, services/usage.py). */
export function UsageLimitGate({ label, used, limit }: UsageLimitGateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">
        You&apos;ve reached your monthly {label} limit.
      </p>
      <p className="text-sm text-muted-foreground">
        {used.toLocaleString()} / {limit.toLocaleString()}
      </p>
      <Button asChild size="sm">
        <Link to="/settings/subscription">Upgrade to continue</Link>
      </Button>
    </div>
  );
}
