import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  capacity_per_hour: string | null;
  capacity_unit: string | null;
  hourly_cost: string;
  status: string;
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500", running: "bg-emerald-500", idle: "bg-amber-400",
  maintenance: "bg-amber-500", breakdown: "bg-destructive", offline: "bg-muted-foreground",
};

export function PrintMachinesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", machine_type: "", capacity_per_hour: "", capacity_unit: "", hourly_cost: "0" });

  const { data: machines, isLoading, error, refetch } = useQuery({
    queryKey: ["print-machines"],
    queryFn: () => apiFetch<Machine[]>("/print-machines"),
  });

  const createMachine = useMutation({
    mutationFn: () =>
      apiFetch<Machine>("/print-machines", {
        method: "POST",
        body: {
          name: form.name,
          machine_type: form.machine_type,
          capacity_per_hour: form.capacity_per_hour ? Number(form.capacity_per_hour) : null,
          capacity_unit: form.capacity_unit || null,
          hourly_cost: Number(form.hourly_cost),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      setShowForm(false);
      setForm({ name: "", machine_type: "", capacity_per_hour: "", capacity_unit: "", hourly_cost: "0" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/print-machines/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["print-machines"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Machines</h1>
          <p className="text-sm text-muted-foreground">Machine monitor -- status, capacity, and rates.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add machine"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New machine</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Digital Press A" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Input value={form.machine_type} onChange={(e) => setForm((f) => ({ ...f, machine_type: e.target.value }))} placeholder="Digital Press" />
              </div>
              <div className="space-y-1.5">
                <Label>Hourly cost</Label>
                <Input type="number" value={form.hourly_cost} onChange={(e) => setForm((f) => ({ ...f, hourly_cost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity / hour</Label>
                <Input type="number" value={form.capacity_per_hour} onChange={(e) => setForm((f) => ({ ...f, capacity_per_hour: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity unit</Label>
                <Input value={form.capacity_unit} onChange={(e) => setForm((f) => ({ ...f, capacity_unit: e.target.value }))} placeholder="sheets" />
              </div>
            </div>
            {createMachine.isError && <ErrorState error={createMachine.error} />}
            <Button onClick={() => createMachine.mutate()} disabled={!form.name || !form.machine_type || createMachine.isPending}>
              {createMachine.isPending ? "Saving..." : "Save machine"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {machines && machines.length === 0 && !showForm && (
        <EmptyState icon={Factory} title="No machines yet" description="Add your presses, printers, and finishing equipment." actionLabel="Add machine" onAction={() => setShowForm(true)} />
      )}

      {machines && machines.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{m.name}</p>
                  <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[m.status] ?? "bg-muted-foreground")} />
                </div>
                <p className="text-xs text-muted-foreground">{m.machine_type}</p>
                {m.capacity_per_hour && (
                  <p className="text-xs text-muted-foreground">{m.capacity_per_hour} {m.capacity_unit ?? ""}/hour</p>
                )}
                <p className="text-xs text-muted-foreground">{formatINR(m.hourly_cost)}/hour</p>
                <select
                  className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={m.status}
                  onChange={(e) => updateStatus.mutate({ id: m.id, status: e.target.value })}
                >
                  {["available", "running", "idle", "maintenance", "breakdown", "offline"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
