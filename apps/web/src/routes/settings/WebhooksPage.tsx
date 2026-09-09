import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MoreHorizontal, Plus, Webhook } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface WebhookSubscription {
  id: string;
  url: string;
  event_types: string[];
  description: string | null;
  is_active: boolean;
}

interface WebhookEvent { event_type: string; description: string }

interface WebhookDelivery {
  id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  response_status: number | null;
  provider_response: string | null;
  created_at: string;
}

function statusBadgeClass(status: string) {
  if (status === "sent") return "border-[#A7F3D0] text-[#047857]";
  if (status === "dead_letter") return "border-[#FED7AA] text-[#C2410C]";
  return "border-[#DDD6FE] text-[#6D28D9]";
}

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ url: "", description: "", event_types: [] as string[] });
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [selected, setSelected] = useState<WebhookSubscription | null>(null);

  const { data: subscriptions, isLoading, error, refetch } = useQuery({
    queryKey: ["webhook-subscriptions"], queryFn: () => apiFetch<WebhookSubscription[]>("/webhook-subscriptions"),
  });
  const { data: events } = useQuery({ queryKey: ["webhook-events"], queryFn: () => apiFetch<WebhookEvent[]>("/webhooks/events") });
  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries", selected?.id],
    queryFn: () => apiFetch<WebhookDelivery[]>(`/webhook-subscriptions/${selected!.id}/deliveries`),
    enabled: !!selected,
  });

  const create = useMutation({
    mutationFn: () => apiFetch<WebhookSubscription & { secret: string }>("/webhook-subscriptions", { method: "POST", body: form }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      setCreatedSecret(created.secret);
      setForm({ url: "", description: "", event_types: [] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch<WebhookSubscription>(`/webhook-subscriptions/${id}`, { method: "PATCH", body: { is_active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/webhook-subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      setSelected(null);
    },
  });

  const retryDelivery = useMutation({
    mutationFn: (deliveryId: string) => apiFetch(`/webhook-deliveries/${deliveryId}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", selected?.id] }),
  });

  function closeCreate() {
    setCreateOpen(false);
    setCreatedSecret(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground">Get a signed HTTP callback when something real happens in your workspace.</p>
        </div>
        <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add webhook
        </Button>
      </div>

      {isLoading && <Skeleton className="h-48" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {subscriptions && subscriptions.length === 0 && (
        <EmptyState icon={Webhook} title="No webhooks configured" description="Add one to get notified when a sales order or invoice is created." actionLabel="Add webhook" onAction={() => setCreateOpen(true)} />
      )}

      {subscriptions && subscriptions.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">Events</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className={`cursor-pointer border-t border-[#E2E8F0] hover:bg-[#F8FAFC] ${selected?.id === s.id ? "bg-[#F8FAFC]" : ""}`} onClick={() => setSelected(s)}>
                    <td className="px-4 py-2">
                      <div className="max-w-xs truncate font-mono text-xs">{s.url}</div>
                      {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.event_types.map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={s.is_active ? "border-[#A7F3D0] text-[#047857]" : "text-muted-foreground"}>
                        {s.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleActive.mutate({ id: s.id, is_active: !s.is_active })}>
                            {s.is_active ? "Disable" : "Enable"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => remove.mutate(s.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{selected ? "Recent deliveries" : "Select a webhook to see deliveries"}</h2>
            {selected && deliveries && deliveries.length === 0 && <p className="text-sm text-muted-foreground">No deliveries yet.</p>}
            {selected && deliveries && deliveries.map((d) => (
              <div key={d.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.event_type}</span>
                  <Badge variant="outline" className={statusBadgeClass(d.status)}>{d.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Attempt {d.attempt_count} {d.response_status ? `-- HTTP ${d.response_status}` : ""} {d.provider_response ? `(${d.provider_response})` : ""}
                </p>
                {d.status === "dead_letter" && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => retryDelivery.mutate(d.id)}>Retry</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdSecret ? "Webhook created" : "Add webhook"}</DialogTitle>
            {!createdSecret && <DialogDescription>Every delivery is signed with an HMAC-SHA256 secret (X-MaterialOS-Signature header) so you can verify it's really us.</DialogDescription>}
          </DialogHeader>

          {createdSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Save this secret now -- it won't be shown again.</p>
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 p-2 font-mono text-xs">
                <span className="flex-1 break-all">{createdSecret}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigator.clipboard.writeText(createdSecret)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <DialogFooter><Button onClick={closeCreate}>Done</Button></DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://yourapp.example.com/webhooks/materialos" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Sync to our ERP" />
                </div>
                <div className="space-y-1.5">
                  <Label>Events</Label>
                  <div className="space-y-2">
                    {(events ?? []).map((ev) => (
                      <label key={ev.event_type} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.event_types.includes(ev.event_type)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              event_types: e.target.checked ? [...f.event_types, ev.event_type] : f.event_types.filter((t) => t !== ev.event_type),
                            }))
                          }
                        />
                        <span>
                          <span className="block font-mono text-xs font-medium">{ev.event_type}</span>
                          <span className="block text-xs text-muted-foreground">{ev.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {create.isError && <ErrorState error={create.error} />}
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate}>Cancel</Button>
                <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => create.mutate()} disabled={!form.url || form.event_types.length === 0 || create.isPending}>
                  {create.isPending ? "Saving..." : "Create webhook"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
