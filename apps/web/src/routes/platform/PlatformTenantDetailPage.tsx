import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface ImpersonationResponse {
  access_token: string;
  tenant_slug: string;
  user_email: string;
}

const STATUS_VARIANT: Record<string, "success" | "destructive" | "outline"> = {
  active: "success",
  suspended: "destructive",
  archived: "outline",
};

export function PlatformTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);

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

  const archiveTenant = useMutation({
    mutationFn: () => platformFetch<{ tenant: TenantDetail; backup_id: string }>(`/platform/tenants/${tenantId}/archive`, { method: "POST" }),
    onSuccess: () => {
      setArchiveOpen(false);
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
  });

  const { data: users } = useQuery({
    queryKey: ["platform-tenant-users", tenantId],
    queryFn: () => platformFetch<TenantUser[]>(`/platform/tenants/${tenantId}/users`),
    enabled: tenant?.status === "active",
  });

  const impersonate = useMutation({
    mutationFn: (userId: string) =>
      platformFetch<ImpersonationResponse>(`/platform/tenants/${tenantId}/users/${userId}/impersonate`, { method: "POST" }),
    onSuccess: (data) => {
      const hash = `token=${encodeURIComponent(data.access_token)}&tenant=${encodeURIComponent(data.tenant_slug)}`;
      window.open(`${window.location.origin}/impersonate#${hash}`, "_blank", "noopener");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/platform/tenants" className="text-sm text-white/60 hover:text-white">
          &larr; All tenants
        </Link>
        <Link to={`/platform/tenants/${tenantId}/audit-logs`} className="text-sm text-white/60 hover:text-white">
          View audit trail &rarr;
        </Link>
      </div>

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
              <Badge variant={STATUS_VARIANT[tenant.status] ?? "outline"}>{tenant.status}</Badge>
              {tenant.status !== "archived" && (
                <>
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
                  <Button variant="destructive" onClick={() => setArchiveOpen(true)}>
                    Archive tenant
                  </Button>
                </>
              )}
            </div>
          </div>

          {tenant.status === "archived" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              This tenant is archived: every user was deactivated and a final backup was taken before archiving. Restoring it means restoring that backup onto a re-activated tenant -- a deliberate, separate action.
            </div>
          )}

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

          {tenant.status === "active" && (
            <div className="rounded-xl bg-white p-4 text-foreground">
              <p className="text-sm font-medium">Users</p>
              {impersonate.isError && <ErrorState error={impersonate.error} />}
              {!users || users.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No users yet.</p>
              ) : (
                <div className="mt-2 divide-y divide-border">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!u.is_active || impersonate.isPending}
                        onClick={() => impersonate.mutate(u.id)}
                      >
                        {u.is_active ? "Impersonate" : "Inactive"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {tenant?.name}?</DialogTitle>
            <DialogDescription>
              This takes a final backup of everything this tenant owns, then deactivates every one of its users -- they lose
              access immediately, on their very next request. This is not reversible from this screen; undoing it means
              restoring that backup onto a re-activated tenant.
            </DialogDescription>
          </DialogHeader>
          {archiveTenant.isError && <ErrorState error={archiveTenant.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => archiveTenant.mutate()} disabled={archiveTenant.isPending}>
              {archiveTenant.isPending ? "Archiving..." : "Archive tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
