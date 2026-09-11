import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface SiteRecord {
  id: string;
  project_id: string;
  name: string;
  city: string | null;
  state: string;
}

const EMPTY_FORM = { name: "", addressLine1: "", city: "", state: "" };

/** Launched from the "+ Quick Add Site" row of the site SearchableSelect,
 * which only appears once a project is chosen -- the project is fixed
 * context, not a field. State is required: it decides CGST+SGST vs IGST
 * on anything delivered here, same as billing_state does for a customer. */
export function QuickAddSiteModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onCreated: (site: SiteRecord) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<SiteRecord>(`/projects/${projectId}/sites`, {
        method: "POST",
        body: {
          name: form.name.trim(),
          address_line1: form.addressLine1.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim(),
        },
      }),
    onSuccess: (site) => {
      queryClient.setQueryData<{ id: string; sites: SiteRecord[] }[]>(["projects"], (old) =>
        old?.map((p) => (p.id === projectId ? { ...p, sites: [...p.sites, site] } : p))
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Site created and selected", { description: site.name });
      onCreated(site);
      onOpenChange(false);
      setForm(EMPTY_FORM);
      create.reset();
    },
  });

  const valid = form.name.trim() && form.state.trim();

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setForm(EMPTY_FORM); create.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Site</DialogTitle>
          <DialogDescription>For {projectName}. This is the delivery destination -- carries its own GSTIN state.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qa-site-name">Site name</Label>
            <Input id="qa-site-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Vizag Site" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-site-city">City</Label>
              <Input id="qa-site-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Visakhapatnam" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-site-state">State</Label>
              <Input id="qa-site-state" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="Andhra Pradesh" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-site-address">Address (optional)</Label>
            <Input id="qa-site-address" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} />
          </div>

          {create.isError && <ErrorState error={create.error} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending ? "Adding..." : "Add Site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
