import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Backup {
  id: string;
  status: string;
  checksum: string | null;
  size_bytes: number | null;
  table_counts: Record<string, number>;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  restored_at: string | null;
  error_message: string | null;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  pending: "outline",
  running: "secondary",
  completed: "success",
  verified: "success",
  failed: "destructive",
  restored: "secondary",
};

/** ADR-013 sec1-14: tenant-scoped logical backups, not a raw pg_dump --
 * "Run Backup Now" only ever kicks off a background task (POST /backups/run
 * returns a `pending` row immediately), never blocks the request on the
 * dump itself. */
export function BackupPage() {
  const queryClient = useQueryClient();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: backups, isLoading, error, refetch } = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiFetch<Backup[]>("/backups"),
    refetchInterval: 10_000,
  });

  const runBackup = useMutation({
    mutationFn: () => apiFetch<Backup>("/backups/run", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });

  const verifyBackup = useMutation({
    mutationFn: (id: string) => apiFetch<Backup>(`/backups/${id}/verify`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });

  const restoreBackup = useMutation({
    mutationFn: (id: string) => apiFetch<Backup>(`/backups/${id}/restore`, { method: "POST", body: { confirm: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
    onSettled: () => setRestoringId(null),
  });

  function handleRestore(backup: Backup) {
    const confirmed = window.confirm(
      `Restore backup from ${backup.completed_at ? new Date(backup.completed_at).toLocaleString() : "this run"}?\n\n` +
        "This replaces your current data (customers, invoices, stock, etc.) with what's in this backup. " +
        "Company, branch, warehouse, and user records are not touched. This cannot be undone."
    );
    if (!confirmed) return;
    setRestoringId(backup.id);
    restoreBackup.mutate(backup.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Backup &amp; recovery</h1>
          <p className="text-sm text-muted-foreground">
            Daily automatic backups plus on-demand runs. Only your own tenant&apos;s data is ever dumped or restored.
          </p>
        </div>
        <Button onClick={() => runBackup.mutate()} disabled={runBackup.isPending}>
          <Database className="h-4 w-4" /> {runBackup.isPending ? "Starting..." : "Run backup now"}
        </Button>
      </div>

      {runBackup.isError && <ErrorState error={runBackup.error} />}
      {restoreBackup.isError && <ErrorState error={restoreBackup.error} />}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {backups && backups.length === 0 && (
        <EmptyState icon={Database} title="No backups yet" description="Run your first backup, or wait for tonight's scheduled run." actionLabel="Run backup now" onAction={() => runBackup.mutate()} />
      )}

      {backups && backups.length > 0 && (
        <div className="space-y-3">
          {backups.map((b) => {
            const tableCount = Object.keys(b.table_counts ?? {}).length;
            const rowCount = Object.values(b.table_counts ?? {}).reduce((sum, n) => sum + n, 0);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{b.status}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {b.completed_at ? new Date(b.completed_at).toLocaleString() : b.started_at ? `Started ${new Date(b.started_at).toLocaleString()}` : "Not started"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tableCount > 0 && `${tableCount} tables, ${rowCount.toLocaleString()} rows`}
                      {b.size_bytes !== null && ` · ${(b.size_bytes / 1024).toFixed(0)} KB`}
                      {b.verified_at && ` · verified ${new Date(b.verified_at).toLocaleDateString()}`}
                      {b.restored_at && ` · restored ${new Date(b.restored_at).toLocaleDateString()}`}
                    </p>
                    {b.error_message && <p className="text-xs text-destructive">{b.error_message}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(b.status === "completed" || b.status === "verified") && (
                      <Button variant="outline" size="sm" onClick={() => verifyBackup.mutate(b.id)} disabled={verifyBackup.isPending}>
                        <ShieldCheck className="h-4 w-4" /> Verify
                      </Button>
                    )}
                    {(b.status === "completed" || b.status === "verified") && (
                      <Button variant="destructive" size="sm" onClick={() => handleRestore(b)} disabled={restoringId === b.id}>
                        <RefreshCw className="h-4 w-4" /> {restoringId === b.id ? "Restoring..." : "Restore"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
