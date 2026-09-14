import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";
import { History } from "lucide-react";

interface AuditLogEntry {
  id: string;
  table_name: string;
  row_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_user_id: string | null;
  occurred_at: string;
}

const ACTION_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  INSERT: "success",
  UPDATE: "secondary",
  DELETE: "destructive",
};

export function PlatformTenantAuditLogPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tableFilter, setTableFilter] = useState("");

  const { data: tables } = useQuery({
    queryKey: ["platform-tenant-audit-tables", tenantId],
    queryFn: () => platformFetch<string[]>(`/platform/tenants/${tenantId}/audit-logs/tables`),
  });

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-tenant-audit-logs", tenantId, tableFilter],
    queryFn: () =>
      platformFetch<AuditLogEntry[]>(
        `/platform/tenants/${tenantId}/audit-logs${tableFilter ? `?table_name=${tableFilter}` : ""}`
      ),
  });

  return (
    <div className="space-y-6">
      <Link to={`/platform/tenants/${tenantId}`} className="text-sm text-white/60 hover:text-white">
        &larr; Back to tenant
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit trail</h1>
          <p className="mt-1 text-sm text-white/60">Every tracked change this tenant's own data has gone through.</p>
        </div>
        {tables && tables.length > 0 && (
          <select
            className="rounded-md border border-white/20 bg-[#0B1220] px-3 py-2 text-sm text-white"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          >
            <option value="">All tables</option>
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {logs && logs.length === 0 && (
        <div className="rounded-xl bg-white p-6">
          <EmptyState icon={History} title="No audit entries" description="Nothing recorded yet for this filter." />
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white text-foreground shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Table</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Row</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-muted/50">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(entry.occurred_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.table_name}</td>
                  <td className="px-4 py-3"><Badge variant={ACTION_VARIANT[entry.action] ?? "secondary"}>{entry.action}</Badge></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.row_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
