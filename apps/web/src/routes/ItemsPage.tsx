import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Sparkles } from "lucide-react";

import { DynamicAttributesFieldset, type AttributeSchemaEntry } from "@/components/items/DynamicAttributesFieldset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useIndustryProfile } from "@/lib/industryProfile";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_uom: string;
  gst_rate: string;
  category_id: string | null;
  standard_price: string;
  standard_cost: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  parameter_schema: AttributeSchemaEntry[];
}

// A building-materials dealer's SKU prefixes are usually already a real
// taxonomy (CEM-, PAI-, ...) -- this just gives that convention friendly
// labels for one-click bulk categorization. Any prefix not listed here
// still gets a category, just named after the prefix itself.
const PREFIX_LABELS: Record<string, string> = {
  CEM: "Cement",
  PAI: "Paints",
  PLU: "Plumbing & Sanitary",
  SAN: "Sanitary Ware",
  HAR: "Hardware",
  TMT: "TMT & Steel",
  STE: "Steel",
  PIP: "Pipes & Fittings",
  ELE: "Electrical",
  TIL: "Tiles",
  PVC: "PVC & Fittings",
  WOO: "Wood & Ply",
  PAN: "Panels & Boards",
};

function EditablePrice({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.standard_price);

  const update = useMutation({
    mutationFn: () => apiFetch(`/items/${item.id}`, { method: "PATCH", body: { standard_price: Number(value) } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        className="h-7 w-24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => update.mutate()}
        onKeyDown={(e) => e.key === "Enter" && update.mutate()}
      />
    );
  }

  const noPriceSet = Number(item.standard_price) === 0;
  return (
    <button
      onClick={() => setEditing(true)}
      className={noPriceSet ? "text-amber-600 underline decoration-dotted" : "hover:underline"}
      title="Click to edit"
    >
      {formatINR(item.standard_price)}
      {noPriceSet && " (set price)"}
    </button>
  );
}

function CategorySelect({ item, categories }: { item: Item; categories: Category[] }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (category_id: string) => apiFetch(`/items/${item.id}`, { method: "PATCH", body: { category_id: category_id || null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  return (
    <select
      value={item.category_id ?? ""}
      onChange={(e) => update.mutate(e.target.value)}
      disabled={update.isPending}
      className={cn(
        "h-8 rounded-md border bg-background px-2 text-sm",
        item.category_id ? "border-input" : "border-dashed border-amber-400 text-amber-600"
      )}
    >
      <option value="">Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

export function ItemsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [autoCategorizeStatus, setAutoCategorizeStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: "", name: "", base_uom: "PCS", gst_rate: "18", standard_price: "0", standard_cost: "0", category_id: "" });
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const { profile } = useIndustryProfile();

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["items", q],
    queryFn: () => apiFetch<Item[]>(`/items${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/categories"),
  });

  const selectedCategory = categories.find((c) => c.id === form.category_id);

  const createItem = useMutation({
    mutationFn: () =>
      apiFetch<Item>("/items", {
        method: "POST",
        body: {
          ...form,
          category_id: form.category_id || null,
          gst_rate: Number(form.gst_rate),
          standard_price: Number(form.standard_price),
          standard_cost: Number(form.standard_cost),
          attributes,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setShowForm(false);
      setForm({ sku: "", name: "", base_uom: "PCS", gst_rate: "18", standard_price: "0", standard_cost: "0", category_id: "" });
      setAttributes({});
    },
  });

  const createCategory = useMutation({
    mutationFn: (name: string) => apiFetch<Category>("/categories", { method: "POST", body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategoryName("");
    },
  });

  const autoCategorize = useMutation({
    mutationFn: async () => {
      const all = await apiFetch<Item[]>("/items");
      const uncategorized = all.filter((i) => !i.category_id);
      if (uncategorized.length === 0) return { assigned: 0, created: 0 };

      const byPrefix = new Map<string, Item[]>();
      for (const item of uncategorized) {
        const prefix = item.sku.includes("-") ? item.sku.slice(0, item.sku.indexOf("-")) : item.sku;
        const list = byPrefix.get(prefix) ?? [];
        list.push(item);
        byPrefix.set(prefix, list);
      }

      let created = 0;
      let assigned = 0;
      const liveCategories = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

      for (const [prefix, groupItems] of byPrefix) {
        const label = PREFIX_LABELS[prefix.toUpperCase()] ?? prefix;
        let category = liveCategories.get(label.toLowerCase());
        if (!category) {
          category = await apiFetch<Category>("/categories", { method: "POST", body: { name: label } });
          liveCategories.set(label.toLowerCase(), category);
          created += 1;
        }
        for (const item of groupItems) {
          await apiFetch(`/items/${item.id}`, { method: "PATCH", body: { category_id: category.id } });
          assigned += 1;
        }
      }
      return { assigned, created };
    },
    onSuccess: ({ assigned, created }) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setAutoCategorizeStatus(
        assigned === 0
          ? "Every item already has a category."
          : `Categorized ${assigned} item${assigned === 1 ? "" : "s"} into ${created} new categor${created === 1 ? "y" : "ies"} by SKU prefix.`
      );
    },
    onError: (err) => setAutoCategorizeStatus(err instanceof ApiError ? err.message : "Could not auto-categorize."),
  });

  const uncategorizedCount = items?.filter((i) => !i.category_id).length ?? 0;

  const filteredItems = useMemo(() => {
    if (!items) return items;
    if (categoryFilter === "all") return items;
    if (categoryFilter === "uncategorized") return items.filter((i) => !i.category_id);
    return items.filter((i) => i.category_id === categoryFilter);
  }, [items, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-sm text-muted-foreground">Selling price, cost, and GST rate live here -- quotations read straight from this.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add item"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="UltraTech OPC53 50KG" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Base unit</Label>
                <Input value={form.base_uom} onChange={(e) => setForm((f) => ({ ...f, base_uom: e.target.value }))} placeholder="BAG" />
              </div>
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input type="number" value={form.gst_rate} onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Selling price</Label>
                <Input type="number" value={form.standard_price} onChange={(e) => setForm((f) => ({ ...f, standard_price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost</Label>
                <Input type="number" value={form.standard_cost} onChange={(e) => setForm((f) => ({ ...f, standard_cost: e.target.value }))} />
              </div>
              <DynamicAttributesFieldset
                schema={selectedCategory?.parameter_schema ?? []}
                value={attributes}
                onChange={setAttributes}
              />
            </div>
            {createItem.isError && <ErrorState error={createItem.error} />}
            <Button onClick={() => createItem.mutate()} disabled={!form.sku || !form.name || createItem.isPending}>
              {createItem.isPending ? "Saving..." : "Save item"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn("rounded-full border px-3 py-1 text-sm", categoryFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}
            >
              All ({items?.length ?? 0})
            </button>
            <button
              onClick={() => setCategoryFilter("uncategorized")}
              className={cn("rounded-full border px-3 py-1 text-sm", categoryFilter === "uncategorized" ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-amber-400 text-amber-600 hover:bg-accent")}
            >
              Uncategorized ({uncategorizedCount})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={cn("rounded-full border px-3 py-1 text-sm", categoryFilter === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}
              >
                {c.name} ({items?.filter((i) => i.category_id === c.id).length ?? 0})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Input
              placeholder="New category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newCategoryName && createCategory.mutate(newCategoryName)}
              className="h-9 w-52"
            />
            <Button variant="outline" size="sm" onClick={() => createCategory.mutate(newCategoryName)} disabled={!newCategoryName || createCategory.isPending}>
              Add category
            </Button>
            {profile?.slug === "building_materials" && (
              <>
                <span className="mx-1 h-5 w-px bg-border" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setAutoCategorizeStatus(null); autoCategorize.mutate(); }}
                  disabled={autoCategorize.isPending || uncategorizedCount === 0}
                >
                  <Sparkles className="h-4 w-4" />
                  {autoCategorize.isPending ? "Categorizing..." : `Auto-categorize by SKU prefix (${uncategorizedCount})`}
                </Button>
              </>
            )}
          </div>
          {autoCategorizeStatus && <p className="text-sm text-muted-foreground">{autoCategorizeStatus}</p>}
        </CardContent>
      </Card>

      <Input placeholder="Search items..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {items && items.length === 0 && !showForm && (
        <EmptyState icon={Package} title="No items yet" description="Add your first item, or import your Tally/Busy catalog." actionLabel="Add item" onAction={() => setShowForm(true)} />
      )}

      {filteredItems && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">GST</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{item.sku}</td>
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2"><CategorySelect item={item} categories={categories} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{item.base_uom}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{item.gst_rate}%</Badge></td>
                  <td className="px-4 py-2"><EditablePrice item={item} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{formatINR(item.standard_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredItems && filteredItems.length === 0 && items && items.length > 0 && (
        <EmptyState icon={Package} title="No items in this category" description="Pick a different category, or assign items to this one." />
      )}
    </div>
  );
}
