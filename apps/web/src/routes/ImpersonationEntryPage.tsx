import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/store/auth";

/** Opened in a fresh tab by the platform console after a real impersonate
 * call (POST /platform/tenants/:id/users/:id/impersonate) -- the token
 * travels in the URL hash fragment, never the path or query string, so it
 * never reaches server access logs. There is deliberately no refresh
 * token: apiFetch never auto-refreshes anyway, and an impersonation
 * session that can't renew itself is exactly as short-lived as its
 * 15-minute access token (see security.py's create_impersonation_token). */
export function ImpersonationEntryPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    const tenantSlug = params.get("tenant");
    if (!token || !tenantSlug) {
      setError("This impersonation link is missing its token -- ask the admin to try again.");
      return;
    }
    setSession({ tenantSlug, accessToken: token, refreshToken: "" });
    history.replaceState(null, "", window.location.pathname);
    navigate("/", { replace: true });
  }, [navigate, setSession]);

  if (error) {
    return <div className="flex h-screen items-center justify-center text-sm text-destructive">{error}</div>;
  }
  return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Signing in...</div>;
}
