import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export type QuickCreateEntityType =
  | "customer"
  | "supplier"
  | "item"
  | "warehouse"
  | "project";

export interface QuickCreateRecord {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface QuickCreateDrawerProps {
  entityType: QuickCreateEntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (record: QuickCreateRecord) => void;
  title?: string;
  initialValues?: Record<string, string>;
  extraData?: Record<string, unknown>; // e.g. branchId or categoryId
}

export function QuickCreateDrawer({
  entityType,
  open,
  onOpenChange,
  onSuccess,
  title,
  initialValues = {},
  extraData = {},
}: QuickCreateDrawerProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Record<string, string>>({
    name: initialValues.name ?? "",
    code: initialValues.code ?? "",
    phone: initialValues.phone ?? "",
    email: initialValues.email ?? "",
    gstin: initialValues.gstin ?? "",
    state: initialValues.state ?? "Andhra Pradesh",
    sku: initialValues.sku ?? "",
    uom: initialValues.uom ?? "PCS",
    price: initialValues.price ?? "0",
    cost: initialValues.cost ?? "0",
    ...initialValues,
  });

  const getEntityConfig = () => {
    switch (entityType) {
      case "customer":
        return {
          title: title ?? "Quick Add Customer",
          endpoint: "/customers",
          queryKey: "customers",
          formatBody: () => ({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            gstin: form.gstin.trim() || null,
            billing_state: form.state.trim() || null,
            credit_limit: 0,
            credit_days: 30,
            ...extraData,
          }),
        };
      case "supplier":
        return {
          title: title ?? "Quick Add Supplier",
          endpoint: "/suppliers",
          queryKey: "suppliers",
          formatBody: () => ({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            gstin: form.gstin.trim() || null,
            billing_state: form.state.trim() || null,
            ...extraData,
          }),
        };
      case "item":
        return {
          title: title ?? "Quick Add Item",
          endpoint: "/items",
          queryKey: "items",
          formatBody: () => ({
            name: form.name.trim(),
            sku: form.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
            base_uom: form.uom.trim() || "PCS",
            gst_rate: "18",
            standard_price: Number(form.price) || 0,
            standard_cost: Number(form.cost) || 0,
            ...extraData,
          }),
        };
      case "warehouse":
        return {
          title: title ?? "Quick Add Warehouse",
          endpoint: "/warehouses",
          queryKey: "warehouses",
          formatBody: () => ({
            name: form.name.trim(),
            code: form.code.trim() || `WH-${Date.now().toString().slice(-3)}`,
            branch_id: extraData.branch_id,
            ...extraData,
          }),
        };
      case "project":
        return {
          title: title ?? "Quick Add Project",
          endpoint: "/projects",
          queryKey: "projects",
          formatBody: () => ({
            name: form.name.trim(),
            code: form.code.trim() || `PRJ-${Date.now().toString().slice(-4)}`,
            customer_id: extraData.customer_id,
            ...extraData,
          }),
        };
    }
  };

  const config = getEntityConfig();

  const create = useMutation({
    mutationFn: () =>
      apiFetch<QuickCreateRecord>(config.endpoint, {
        method: "POST",
        body: config.formatBody(),
      }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success(`${record.name} created`, {
        description: "Automatically selected in your current form.",
      });
      onSuccess(record);
      onOpenChange(false);
      create.reset();
    },
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-bold">{config.title}</DrawerTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Minimal required fields. Returns directly to your current workflow.
          </p>
        </DrawerHeader>

        <DrawerBody className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">Name *</Label>
            <Input
              id="qc-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Industries"
              required
            />
          </div>

          {(entityType === "customer" || entityType === "supplier") && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qc-phone">Phone</Label>
                  <Input
                    id="qc-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qc-email">Email</Label>
                  <Input
                    id="qc-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qc-gstin">GSTIN / Tax ID</Label>
                <Input
                  id="qc-gstin"
                  value={form.gstin}
                  onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  placeholder="37AAAAA0000A1Z5"
                />
              </div>
            </>
          )}

          {entityType === "item" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qc-sku">SKU Code</Label>
                  <Input
                    id="qc-sku"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    placeholder="e.g. TMT-12MM"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qc-uom">Unit of Measure (UOM)</Label>
                  <Input
                    id="qc-uom"
                    value={form.uom}
                    onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value.toUpperCase() }))}
                    placeholder="PCS, KG, MT, BAG"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qc-price">Selling Price (₹)</Label>
                  <Input
                    id="qc-price"
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qc-cost">Standard Cost (₹)</Label>
                  <Input
                    id="qc-cost"
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}

          {(entityType === "warehouse" || entityType === "project") && (
            <div className="space-y-1.5">
              <Label htmlFor="qc-code">Code</Label>
              <Input
                id="qc-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. WH-01"
              />
            </div>
          )}

          {create.isError && <ErrorState error={create.error} />}
        </DrawerBody>

        <DrawerFooter className="border-t border-border/40 pt-3">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating..." : "Create & Select"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
