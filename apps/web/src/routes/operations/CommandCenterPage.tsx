import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Database, HardDrive, Server, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ComponentHealth {
  name: string;
  status: string;
  latency_ms: number | null;
  detail: string | null;
}

interface Backup {
  id: string;
  status: string;
  completed_at: string | null;
  size_bytes: number | null;
}

interface CommandCenter {
  system_health: { checked_at: string; overall: string; components: ComponentHealth[] };
  last_backup: Backup | null;
  backups_last_7_days: number;
  failed_backups_last_7_days: number;
  backup_success_rate_pct: number | null;
  notification_deliveries_last_7_days: number;
  failed_deliveries_last_7_days: number;
  notification_delivery_rate_pct: number | null;
  dead_letter_count: number;
  audit_events_last_24h: number;
}

const COMPONENT_ICON: Record<string, React.ElementType> = {
  database: Database, redis: Zap, object_storage: HardDrive, background_worker: Server,
};

const STATUS_STYLES: Record<string, string> = {
  healthy: "text-emerald-600", degraded: "text-amber-600", unavailable: "text-destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium capitalize", STATUS_STYLES[status] ?? "text-muted-foreground")}>
      {status === "healthy" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

/** sec50/61: the operational control plane in one place -- system
 * health, backup health, notification delivery, and recent audit
 * activity, not four screens an administrator has to visit
 * separately. */
export function CommandCenterPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["command-center"],
    queryFn: () => apiFetch<CommandCenter>("/command-center"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Command center</h1>
          <p className="text-sm text-muted-foreground">System health, backups, notifications, and audit activity at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <StatusBadge status={data.system_health.overall} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">System health</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.system_health.components.map((c) => {
              const Icon = COMPONENT_ICON[c.name] ?? Server;
              return (
                <div key={c.name} className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium capitalize">
                    <Icon className="h-4 w-4 text-muted-foreground" /> {c.name.replace(/_/g, " ")}
                  </div>
                  <div className="mt-1"><StatusBadge status={c.status} /></div>
                  {c.latency_ms !== null && <p className="mt-0.5 text-xs text-muted-foreground">{c.latency_ms}ms</p>}
                  {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Backups</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Last backup</span><span>{data.last_backup ? data.last_backup.status : "None yet"}</span></div>
            {data.last_backup?.completed_at && (
              <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{new Date(data.last_backup.completed_at).toLocaleString()}</span></div>
            )}
            {data.last_backup?.size_bytes && (
              <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{(data.last_backup.size_bytes / 1024).toFixed(0)} KB</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Last 7 days</span><span>{data.backups_last_7_days} runs, {data.failed_backups_last_7_days} failed</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Success rate</span><span>{data.backup_success_rate_pct ?? "-"}%</span></div>
            <Link to="/operations/backups" className="inline-block pt-1 text-sm font-medium text-primary hover:underline">View backups &rarr;</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Last 7 days</span><span>{data.notification_deliveries_last_7_days} deliveries</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Failed</span><span>{data.failed_deliveries_last_7_days}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery rate</span><span>{data.notification_delivery_rate_pct ?? "-"}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dead letters</span><span>{data.dead_letter_count}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Audit activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Last 24 hours</span><span>{data.audit_events_last_24h} events</span></div>
            <Link to="/operations/audit-log" className="inline-block pt-1 text-sm font-medium text-primary hover:underline">View audit log &rarr;</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
