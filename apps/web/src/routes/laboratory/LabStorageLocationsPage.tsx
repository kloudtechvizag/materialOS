import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface StorageLocation {
  id: string;
  parent_location_id: string | null;
  parent_name: string | null;
  code: string;
  name: string;
  location_type: string;
  temperature_c: string | null;
  is_active: boolean;
}

const LOCATION_TYPES = ["room", "freezer", "refrigerator", "cabinet", "shelf", "rack", "box"];
const EMPTY_FORM = { parent_location_id: "", code: "", name: "", location_type: "freezer", temperature_c: "" };

export function LabStorageLocationsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: locations, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-storage-locations"],
    queryFn: () => apiFetch<StorageLocation[]>("/lab/storage-locations"),
  });

  const createLocation = useMutation({
    mutationFn: () =>
      apiFetch<StorageLocation>("/lab/storage-locations", {
        method: "POST",
        body: { ...form, parent_location_id: form.parent_location_id || null, temperature_c: form.temperature_c || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-storage-locations"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Storage locations</h1>
          <p className="text-sm text-muted-foreground">Freezer &rarr; shelf &rarr; rack &rarr; box, or as deep as your lab needs.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add location</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {locations && locations.length === 0 && (
        <EmptyState icon={Warehouse} title="No storage locations yet" description="Add a freezer, shelf, or rack to start tracking sample custody." actionLabel="Add location" onAction={() => setAddOpen(true)} />
      )}

      {locations && locations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Temp (&deg;C)</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{l.code}</td>
                  <td className="px-4 py-2 font-medium">{l.name}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{l.location_type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.parent_name ?? "--"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.temperature_c ?? "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add storage location</DialogTitle>
            <DialogDescription>Optionally nest it under an existing location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="FZ1-S2" />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Shelf 2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.location_type}
                  onChange={(e) => setForm((f) => ({ ...f, location_type: e.target.value }))}
                >
                  {LOCATION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Temperature (&deg;C)</Label>
                <Input value={form.temperature_c} onChange={(e) => setForm((f) => ({ ...f, temperature_c: e.target.value }))} placeholder="-20.0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Parent location</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.parent_location_id}
                onChange={(e) => setForm((f) => ({ ...f, parent_location_id: e.target.value }))}
              >
                <option value="">None (top-level)</option>
                {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          {createLocation.isError && <ErrorState error={createLocation.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createLocation.mutate()} disabled={!form.code || !form.name || createLocation.isPending}>
              {createLocation.isPending ? "Saving..." : "Add location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
