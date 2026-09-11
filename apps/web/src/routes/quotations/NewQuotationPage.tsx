import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { QuickAddContactModal } from "@/components/entities/QuickAddContactModal";
import { QuickAddProjectModal } from "@/components/entities/QuickAddProjectModal";
import { QuickAddSiteModal } from "@/components/entities/QuickAddSiteModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
import { ItemSelect } from "@/components/items/ItemSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type { CategoryLite } from "@/lib/items";

interface Customer { id: string; name: string; }
interface Project { id: string; customer_id: string; name: string; sites: { id: string; name: string; state: string }[]; }
interface Item { id: string; name: string; base_uom: string; standard_price: string; category_id: string | null; }

interface Line { item_id: string; qty: string; uom: string; }

export function NewQuotationPage() {
  const navigate = useNavigate();
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: () => apiFetch<Project[]>("/projects") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<CategoryLite[]>("/categories") });

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", qty: "", uom: "" }]);

  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickAddProjectOpen, setQuickAddProjectOpen] = useState(false);
  const [quickAddSiteOpen, setQuickAddSiteOpen] = useState(false);

  const customerProjects = projects?.filter((p) => p.customer_id === customerId) ?? [];
  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const selectedProject = customerProjects.find((p) => p.id === projectId);

  const createQuotation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/quotations", {
        method: "POST",
        body: {
          customer_id: customerId,
          project_id: projectId || null,
          site_id: siteId || null,
          lines: lines
            .filter((l) => l.item_id && l.qty)
            .map((l) => ({ item_id: l.item_id, qty: Number(l.qty), uom: l.uom || undefined })),
        },
      }),
    onSuccess: (quotation) => navigate(`/quotations/${quotation.id}`),
  });

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const validLines = lines.filter((l) => l.item_id && l.qty);
  const estimatedTotal = validLines.reduce((sum, l) => {
    const item = items?.find((i) => i.id === l.item_id);
    return sum + (item ? Number(item.standard_price) * Number(l.qty || 0) : 0);
  }, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New quotation</h1>
        <p className="text-sm text-muted-foreground">Customer, project, and site typed once here carry through order, dispatch, and invoice.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Customer &amp; project</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <SearchableSelect
              options={customers?.map((c) => ({ id: c.id, label: c.name }))}
              value={customerId}
              onChange={(id) => { setCustomerId(id); setProjectId(""); setSiteId(""); }}
              placeholder="Select customer"
              searchPlaceholder="Search customers..."
              emptyText="No customers match."
              quickAddLabel="Quick Add Customer"
              onQuickAdd={() => setQuickAddCustomerOpen(true)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <SearchableSelect
              options={customerProjects.map((p) => ({ id: p.id, label: p.name }))}
              value={projectId}
              onChange={(id) => { setProjectId(id); setSiteId(""); }}
              placeholder="No project"
              searchPlaceholder="Search projects..."
              emptyText="No projects for this customer."
              disabled={!customerId}
              quickAddLabel="Quick Add Project"
              onQuickAdd={customerId ? () => setQuickAddProjectOpen(true) : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Site (optional)</Label>
            <SearchableSelect
              options={selectedProject?.sites.map((s) => ({ id: s.id, label: s.name, sublabel: s.state }))}
              value={siteId}
              onChange={setSiteId}
              placeholder="No site"
              searchPlaceholder="Search sites..."
              emptyText="No sites on this project."
              disabled={!selectedProject}
              quickAddLabel="Quick Add Site"
              onQuickAdd={selectedProject ? () => setQuickAddSiteOpen(true) : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, i) => {
            const item = items?.find((it) => it.id === line.item_id);
            return (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <ItemSelect
                  className="col-span-6"
                  items={items}
                  categories={categories}
                  value={line.item_id}
                  onChange={(itemId) => {
                    const selected = items?.find((it) => it.id === itemId);
                    updateLine(i, { item_id: itemId, uom: selected?.base_uom ?? "" });
                  }}
                />
                <Input className="col-span-2" type="number" placeholder="Qty" value={line.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
                <Input className="col-span-2" placeholder="Unit" value={line.uom || item?.base_uom || ""} onChange={(e) => updateLine(i, { uom: e.target.value })} />
                <span className="col-span-1 text-sm text-muted-foreground">
                  {item ? `₹${(Number(item.standard_price) * Number(line.qty || 0)).toFixed(0)}` : ""}
                </span>
                <button
                  className="col-span-1 flex justify-end text-muted-foreground hover:text-destructive"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {item && Number(item.standard_price) === 0 && (
                  <p className="col-span-12 text-xs text-amber-600">
                    No selling price set for "{item.name}" -- it will quote at ₹0. Set a price on the Items page first.
                  </p>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { item_id: "", qty: "", uom: "" }])}>
            <Plus className="h-4 w-4" /> Add line
          </Button>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Estimated subtotal (excl. tax)</span>
            <span className="text-lg font-semibold">₹{estimatedTotal.toFixed(0)}</span>
          </div>

          {createQuotation.isError && <ErrorState error={createQuotation.error} />}
          <Button
            onClick={() => createQuotation.mutate()}
            disabled={!customerId || validLines.length === 0 || createQuotation.isPending}
          >
            {createQuotation.isPending ? "Creating..." : "Create quotation"}
          </Button>
        </CardContent>
      </Card>

      <QuickAddContactModal<Customer>
        open={quickAddCustomerOpen}
        onOpenChange={setQuickAddCustomerOpen}
        title="Customer"
        endpoint="/customers"
        queryKey="customers"
        onCreated={(customer) => { setCustomerId(customer.id); setProjectId(""); setSiteId(""); }}
      />
      {customerId && (
        <QuickAddProjectModal
          open={quickAddProjectOpen}
          onOpenChange={setQuickAddProjectOpen}
          customerId={customerId}
          customerName={selectedCustomer?.name ?? ""}
          onCreated={(project) => { setProjectId(project.id); setSiteId(""); }}
        />
      )}
      {selectedProject && (
        <QuickAddSiteModal
          open={quickAddSiteOpen}
          onOpenChange={setQuickAddSiteOpen}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onCreated={(site) => setSiteId(site.id)}
        />
      )}
    </div>
  );
}
