import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface ItemRecord {
  id: string;
  sku: string;
  name: string;
  base_uom: string;
  gst_rate: string;
  category_id: string | null;
  standard_price: string;
}

const EMPTY_FORM = { name: "", sku: "", price: "0", unit: "PCS", gstRate: "18" };

/** Auto-generated when SKU is left blank -- items.sku is required and
 * unique per tenant/company, but a quick-add flow shouldn't force the
 * user to invent a code on the spot. Collision odds are negligible; on
 * the rare clash the backend's uniqueness error surfaces via ErrorState
 * and the user can pick an explicit SKU instead. */
function generateSku(name: string): string {
  const prefix = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "X") || "ITM";
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function QuickAddItemModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: ItemRecord) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<ItemRecord>("/items", {
        method: "POST",
        body: {
          name: form.name.trim(),
          sku: form.sku.trim() || generateSku(form.name),
          base_uom: form.unit.trim() || "PCS",
          gst_rate: Number(form.gstRate || 0),
          standard_price: Number(form.price || 0),
          standard_cost: 0,
          category_id: null,
          attributes: {},
        },
      }),
    onSuccess: (item) => {
      queryClient.setQueryData<ItemRecord[]>(["items"], (old) => (old ? [item, ...old] : [item]));
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item created and selected", { description: item.name });
      onCreated(item);
      onOpenChange(false);
      setForm(EMPTY_FORM);
      create.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setForm(EMPTY_FORM); create.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Item</DialogTitle>
          <DialogDescription>Price and tax can be refined later on the Items page.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name.trim()) create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-item-name">Item name</Label>
              <Input id="qa-item-name" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-item-sku">SKU / Code (optional)</Label>
              <Input id="qa-item-sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Auto-generated" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-item-price">Unit price</Label>
              <Input id="qa-item-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-item-unit">Unit</Label>
              <Input id="qa-item-unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="Tons, Bags, SqFt" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-item-gst">Tax rate %</Label>
              <Input id="qa-item-gst" type="number" min="0" step="0.01" value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))} />
            </div>
          </div>

          {create.isError && <ErrorState error={create.error} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim() || create.isPending}>
              {create.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
