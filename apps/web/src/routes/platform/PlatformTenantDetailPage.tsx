import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  company_name: string | null;
  user_count: number;
  plan_name: string | null;
  subscription_status: string | null;
  active_features: string[];
}

export function PlatformTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-tenant", tenantId],
    queryFn: () => platformFetch<TenantDetail>(`/platform/tenants/${tenantId}`),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => platformFetch<TenantDetail>(`/platform/tenants/${tenantId}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/platform/tenants" className="text-sm text-white/60 hover:text-white">
        &larr; All tenants
      </Link>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {tenant && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{tenant.name}</h1>
              <p className="mt-1 text-sm text-white/60">
                {tenant.slug} &middot; created {new Date(tenant.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={tenant.status === "active" ? "success" : "destructive"}>{tenant.status}</Badge>
              {tenant.status === "active" ? (
                <Button
                  variant="outline"
                  className="bg-white text-foreground hover:text-accent-foreground"
                  onClick={() => updateStatus.mutate("suspended")}
                  disabled={updateStatus.isPending}
                >
                  Suspend tenant
                </Button>
              ) : (
                <Button onClick={() => updateStatus.mutate("active")} disabled={updateStatus.isPending}>
                  Reactivate tenant
                </Button>
              )}
            </div>
          </div>

          {updateStatus.isError && <ErrorState error={updateStatus.error} />}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 text-foreground">
              <p className="text-xs text-muted-foreground">Company</p>
              <p className="mt-1 font-medium">{tenant.company_name ?? "--"}</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-foreground">
              <p className="text-xs text-muted-foreground">Active users</p>
              <p className="mt-1 font-medium">{tenant.user_count}</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-foreground">
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="mt-1 font-medium">
                {tenant.plan_name ?? "No plan"}
                {tenant.subscription_status && <span className="ml-1.5 text-xs text-muted-foreground">({tenant.subscription_status})</span>}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 text-foreground">
            <p className="text-sm font-medium">Active features (from current plan)</p>
            {tenant.active_features.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No plan-granted features -- no active subscription, or a plan with none configured.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tenant.active_features.map((f) => (
                  <Badge key={f} variant="secondary">{f}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
