import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface ContactRecord {
  id: string;
  name: string;
}

const EMPTY_FORM = { name: "", phone: "", email: "", gstin: "" };

/** Customers and suppliers are the same shape at quick-add time (name,
 * phone/email, GSTIN) -- one modal parameterized by endpoint instead of
 * two near-identical components. Used from the "+ Quick Add Customer"
 * and "+ Quick Add Supplier" rows of SearchableSelect. */
export function QuickAddContactModal<T extends ContactRecord>({
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
  const [form, setForm] = useState(EMPTY_FORM);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<T>(endpoint, {
        method: "POST",
        body: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          gstin: form.gstin.trim() || null,
        },
      }),
    onSuccess: (record) => {
      queryClient.setQueryData<T[]>([queryKey], (old) => (old ? [record, ...old] : [record]));
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} created and selected`, { description: record.name });
      onCreated(record);
      onOpenChange(false);
      setForm(EMPTY_FORM);
      create.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setForm(EMPTY_FORM); create.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add {title}</DialogTitle>
          <DialogDescription>Adds the minimum you need now -- the full record can be filled in later.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name.trim()) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qa-contact-name">Name</Label>
            <Input id="qa-contact-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-contact-phone">Phone</Label>
              <Input id="qa-contact-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-contact-email">Email</Label>
              <Input id="qa-contact-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-contact-gstin">GSTIN / Tax ID (optional)</Label>
            <Input id="qa-contact-gstin" value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))} />
          </div>

          {create.isError && <ErrorState error={create.error} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim() || create.isPending}>
              {create.isPending ? "Adding..." : `Add ${title}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
