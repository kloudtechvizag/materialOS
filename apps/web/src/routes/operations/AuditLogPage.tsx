import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: string;
  table_name: string;
  row_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_user_id: string | null;
  occurred_at: string;
}

const ACTION_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  INSERT: "success",
  UPDATE: "secondary",
  DELETE: "destructive",
};

function selectClass() {
  return "flex h-9 rounded-md border border-input bg-background px-3 text-sm";
}

/** ADR-013 sec35-38: reads the audit_log rows the DB trigger has already
 * been writing since Slice 0 -- this page is the first thing that ever
 * reads them back. RLS means this can never show another tenant's rows. */
export function AuditLogPage() {
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { data: tables } = useQuery({
    queryKey: ["audit-log-tables"],
    queryFn: () => apiFetch<string[]>("/audit-logs/tables"),
  });

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ["audit-logs", tableFilter, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tableFilter) params.set("table_name", tableFilter);
      if (actionFilter) params.set("action", actionFilter);
      const qs = params.toString();
      return apiFetch<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ""}`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">Every insert, update, and delete across your tenant, captured automatically.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className={selectClass()} value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="">All tables</option>
          {tables?.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={selectClass()} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {logs && logs.length === 0 && (
        <EmptyState icon={History} title="No matching audit events" description="Try a different table or action filter." />
      )}

      {logs && logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="space-y-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>{log.action}</Badge>
                    <span className="font-medium">{log.table_name}</span>
                    <span className="text-xs text-muted-foreground">{log.row_id}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.occurred_at).toLocaleString()}</span>
                </div>
                {(log.old_data || log.new_data) && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">View data</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {log.old_data && (
                        <pre className="overflow-x-auto rounded-md bg-muted p-2">{JSON.stringify(log.old_data, null, 2)}</pre>
                      )}
                      {log.new_data && (
                        <pre className="overflow-x-auto rounded-md bg-muted p-2">{JSON.stringify(log.new_data, null, 2)}</pre>
                      )}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
