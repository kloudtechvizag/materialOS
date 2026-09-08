import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface NotificationRule {
  id: string;
  name: string;
  trigger_type: string;
  threshold_value: string | null;
  priority: string;
  channels: string[];
  is_active: boolean;
}

interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
  attempt_count: number;
  provider_response: string | null;
  sent_at: string | null;
  created_at: string;
}

const PRIORITY_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  info: "outline",
  warning: "secondary",
  critical: "destructive",
  success: "success",
};

/** ADR-013 sec21-22 (rules) and sec41-43 (dead letters) -- administrators
 * decide what they want to hear about and through which channels;
 * deliveries that exhausted their retries land here for manual retry
 * rather than silently vanishing. */
export function NotificationRulesPage() {
  const queryClient = useQueryClient();

  const { data: rules, isLoading, error, refetch } = useQuery({
    queryKey: ["notification-rules"],
    queryFn: () => apiFetch<NotificationRule[]>("/notifications/rules"),
  });

  const { data: deadLetters, isLoading: dlLoading, error: dlError } = useQuery({
    queryKey: ["notification-dead-letters"],
    queryFn: () => apiFetch<NotificationDelivery[]>("/notifications/dead-letters"),
  });

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const toggleRule = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch<NotificationRule>(`/notifications/rules/${id}`, { method: "PATCH", body: { is_active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-rules"] }),
  });

  const retryDelivery = useMutation({
    mutationFn: (id: string) => apiFetch<NotificationDelivery>(`/notifications/dead-letters/${id}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-dead-letters"] }),
    onSettled: () => setRetryingId(null),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification rules</h1>
        <p className="text-sm text-muted-foreground">Configure which events raise alerts, at what threshold, and how urgently.</p>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {rules && rules.length === 0 && (
        <EmptyState icon={Bell} title="No notification rules" description="Default rules are created automatically at signup." />
      )}

      {rules && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={PRIORITY_VARIANT[rule.priority] ?? "outline"}>{rule.priority}</Badge>
                    {!rule.is_active && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rule.trigger_type}
                    {rule.threshold_value && ` · threshold ${rule.threshold_value}`}
                    {" · "}
                    {rule.channels.join(", ")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })}
                  disabled={toggleRule.isPending}
                >
                  {rule.is_active ? "Disable" : "Enable"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Dead letters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dlLoading && <Skeleton className="h-24" />}
          {dlError && <ErrorState error={dlError} />}
          {deadLetters && deadLetters.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing here -- every delivery either succeeded or is still retrying.</p>
          )}
          {deadLetters && deadLetters.length > 0 && (
            <div className="space-y-2">
              {deadLetters.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{d.status}</Badge>
                      <span className="font-medium capitalize">{d.channel}</span>
                      <span className="text-xs text-muted-foreground">{d.attempt_count} attempts</span>
                    </div>
                    {d.provider_response && <p className="text-xs text-muted-foreground">{d.provider_response}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRetryingId(d.id);
                      retryDelivery.mutate(d.id);
                    }}
                    disabled={retryingId === d.id}
                  >
                    <RotateCcw className="h-4 w-4" /> {retryingId === d.id ? "Retrying..." : "Retry"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
