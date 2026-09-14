import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface CodeNameRecord {
  id: string;
  code: string;
  name: string;
}

function deriveCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** For the many simple {code, name} catalog entities across every
 * industry profile (sample type, container, unit, category, payment
 * method, ...) -- one modal parameterized by endpoint instead of a
 * bespoke component per entity, mirroring QuickAddContactModal's own
 * "same shape at quick-add time" reasoning. Code is auto-derived from
 * the name (shown read-only) rather than asked for separately -- the
 * platform's "capture minimum viable master data now" principle. */
export function QuickAddCodeNameModal<T extends CodeNameRecord>({
  open,
  onOpenChange,
  title,
  endpoint,
  queryKey,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  endpoint: string;
  queryKey: string;
  onCreated: (record: T) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const code = deriveCode(name);

  const create = useMutation({
    mutationFn: () => apiFetch<T>(endpoint, { method: "POST", body: { code, name: name.trim() } }),
    onSuccess: (record) => {
      queryClient.setQueryData<T[]>([queryKey], (old) => (old ? [record, ...old] : [record]));
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} created and selected`, { description: record.name });
      onCreated(record);
      onOpenChange(false);
      setName("");
      create.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setName(""); create.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add {title}</DialogTitle>
          <DialogDescription>Adds the minimum you need now -- the full record can be filled in later.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && code) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qa-codename-name">{title} name</Label>
            <Input id="qa-codename-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            {code && <p className="text-xs text-muted-foreground">Code: {code}</p>}
          </div>

          {create.isError && <ErrorState error={create.error} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !code || create.isPending}>
              {create.isPending ? "Adding..." : `Add ${title}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
