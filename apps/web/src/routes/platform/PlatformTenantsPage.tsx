import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";
import { Building2 } from "lucide-react";

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  company_name: string | null;
  user_count: number;
  plan_name: string | null;
  subscription_status: string | null;
}

interface TenantListResponse {
  tenants: TenantSummary[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 25;

export function PlatformTenantsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-tenants", q, page],
    queryFn: () =>
      platformFetch<TenantListResponse>(
        `/platform/tenants?page=${page}&page_size=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`
      ),
  });
  const tenants = data?.tenants;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="mt-1 text-sm text-white/60">Every MaterialOS workspace, across every industry.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search by name or workspace slug..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-sm bg-white text-foreground"
        />
        {data && <p className="text-sm text-white/60">{data.total.toLocaleString()} tenants</p>}
      </div>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {tenants && tenants.length === 0 && (
        <div className="rounded-xl bg-white p-6">
          <EmptyState icon={Building2} title="No tenants match" description="Try a different search term." />
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white text-foreground shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted">
                  <td className="px-4 py-3">
                    <Link to={`/platform/tenants/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">{t.company_name ?? <span className="text-muted-foreground">--</span>}</td>
                  <td className="px-4 py-3">
                    {t.plan_name ?? <span className="text-muted-foreground">No plan</span>}
                    {t.subscription_status && (
                      <span className="ml-1.5 text-xs text-muted-foreground">({t.subscription_status})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{t.user_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === "active" ? "success" : "destructive"}>{t.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
