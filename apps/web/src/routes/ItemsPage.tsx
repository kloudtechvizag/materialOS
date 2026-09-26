import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  Eye,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { DynamicAttributesFieldset, type AttributeSchemaEntry } from "@/components/items/DynamicAttributesFieldset";
import { ItemImage } from "@/components/items/ItemImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  BulkActionBar,
  DetailDrawer,
  MetricStrip,
  RowActions,
  SavedViews,
  SmartEmptyState,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch, ApiError } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
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
  reorder_level: string | null;
  is_active: boolean;
  image_path: string | null;
}

interface Category {
  id: string;
  name: string;
  parameter_schema: AttributeSchemaEntry[];
}

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
    mutationFn: () =>
      apiFetch(`/items/${item.id}`, { method: "PATCH", body: { standard_price: Number(value) } }),
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
        className="h-7 w-24 text-xs font-mono"
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
      className={cn(
        "font-mono text-xs hover:underline",
        noPriceSet ? "text-amber-600 dark:text-amber-400 underline decoration-dotted font-medium" : "text-foreground font-semibold"
      )}
      title="Click to edit selling price"
    >
      {formatINR(item.standard_price)}
      {noPriceSet && " (set)"}
    </button>
  );
}

function CategorySelect({ item, categories }: { item: Item; categories: Category[] }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (category_id: string) =>
      apiFetch(`/items/${item.id}`, { method: "PATCH", body: { category_id: category_id || null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  return (
    <select
      value={item.category_id ?? ""}
      onChange={(e) => update.mutate(e.target.value)}
      disabled={update.isPending}
      className={cn(
        "h-7 rounded-md border bg-background px-2 text-xs",
        item.category_id ? "border-input text-foreground" : "border-dashed border-amber-400 text-amber-600"
      )}
    >
      <option value="">Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ItemImageCell({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<Item>(`/items/${item.id}/image`, { method: "POST", body: formData, isFormData: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative block h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border"
        title="Click to upload a photo"
      >
        <ItemImage itemId={item.id} imagePath={item.image_path} alt={item.name} className="h-full w-full object-cover" />
        <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-[9px] font-medium text-white group-hover:flex">
          {upload.isPending ? "..." : "Edit"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function ItemsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [autoCategorizeStatus, setAutoCategorizeStatus] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    base_uom: "PCS",
    gst_rate: "18",
    standard_price: "0",
    standard_cost: "0",
    reorder_level: "",
    category_id: "",
  });
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const { profile } = useIndustryProfile();

  const { data: items = [], isLoading, error, refetch, isRefetching } = useQuery({
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
          reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
          attributes,
        },
      }),
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success(`${newItem.name} added to catalog`);
      setShowForm(false);
      setForm({
        sku: "",
        name: "",
        base_uom: "PCS",
        gst_rate: "18",
        standard_price: "0",
        standard_cost: "0",
        reorder_level: "",
        category_id: "",
      });
      setAttributes({});
    },
  });

  const createCategory = useMutation({
    mutationFn: (name: string) => apiFetch<Category>("/categories", { method: "POST", body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
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

  // Business calculations
  const { uncategorizedCount, zeroPriceCount, withReorderLevel } = useMemo(() => {
    let uncat = 0;
    let zeroPrice = 0;
    let reorder = 0;

    for (const item of items) {
      if (!item.category_id) uncat++;
      if (Number(item.standard_price) === 0) zeroPrice++;
      if (item.reorder_level) reorder++;
    }

    return {
      uncategorizedCount: uncat,
      zeroPriceCount: zeroPrice,
      withReorderLevel: reorder,
    };
  }, [items]);

  const itemLabel = profile?.terminology?.item_label ?? "Item";
  const itemsLabel = profile?.terminology?.items_label ?? "Items";
  const nameExample = profile?.terminology?.item_name_example ?? "e.g. Product name";
  const uomExample = profile?.terminology?.item_uom_example ?? "PCS";

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: `Total ${itemsLabel}`,
        value: items.length,
        sublabel: `${categories.length} categories active`,
        icon: Package,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "priced",
        label: "Priced SKUs",
        value: items.length - zeroPriceCount,
        sublabel: "Ready for quotations & POS",
        icon: Tag,
        color: "emerald",
        active: activeView === "priced",
        onClick: () => setActiveView("priced"),
      },
      {
        id: "zero-price",
        label: "Missing Selling Price",
        value: zeroPriceCount,
        sublabel: "Needs price assignment",
        icon: AlertTriangle,
        color: zeroPriceCount > 0 ? "rose" : "slate",
        active: activeView === "zero_price",
        onClick: () => setActiveView("zero_price"),
      },
      {
        id: "uncategorized",
        label: "Uncategorized",
        value: uncategorizedCount,
        sublabel: "Missing taxonomy",
        icon: Layers,
        color: uncategorizedCount > 0 ? "amber" : "slate",
        active: activeView === "uncategorized",
        onClick: () => setActiveView("uncategorized"),
      },
      {
        id: "reorder",
        label: "Reorder Monitored",
        value: withReorderLevel,
        sublabel: "Configured reorder levels",
        icon: WarehouseIcon,
        color: "sky",
        active: activeView === "reorder",
        onClick: () => setActiveView("reorder"),
      },
    ],
    [
      items.length,
      itemsLabel,
      categories.length,
      zeroPriceCount,
      uncategorizedCount,
      withReorderLevel,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const itemsList: AttentionItem[] = [];

    if (zeroPriceCount > 0) {
      itemsList.push({
        id: "att-zero-price",
        title: `${zeroPriceCount} ${itemsLabel.toLowerCase()} with zero price`,
        severity: "critical",
        count: zeroPriceCount,
        description: "Items without selling prices cannot be quoted or sold without manual overrides.",
        actionLabel: "Filter unpriced",
        onClick: () => setActiveView("zero_price"),
      });
    }

    if (uncategorizedCount > 0) {
      itemsList.push({
        id: "att-uncategorized",
        title: `${uncategorizedCount} uncategorized ${itemsLabel.toLowerCase()}`,
        severity: "warning",
        count: uncategorizedCount,
        description: "Organize items into categories for dynamic attributes and analytics.",
        actionLabel: "View uncategorized",
        onClick: () => setActiveView("uncategorized"),
      });
    }

    return itemsList;
  }, [zeroPriceCount, uncategorizedCount, itemsLabel]);

  // Views & Filtering
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      // Saved views
      if (activeView === "priced" && Number(i.standard_price) === 0) return false;
      if (activeView === "zero_price" && Number(i.standard_price) > 0) return false;
      if (activeView === "uncategorized" && Boolean(i.category_id)) return false;
      if (activeView === "reorder" && !i.reorder_level) return false;

      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized" && i.category_id) return false;
        if (categoryFilter !== "uncategorized" && i.category_id !== categoryFilter) return false;
      }

      return true;
    });
  }, [items, activeView, categoryFilter]);

  // Selections
  function toggleSelectAll() {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredItems.map((i) => [
      i.sku,
      i.name,
      categories.find((c) => c.id === i.category_id)?.name ?? "Uncategorized",
      i.base_uom,
      i.gst_rate,
      i.standard_price,
      i.standard_cost,
      i.reorder_level ?? "",
    ]);
    downloadCsv("materialos_catalog_items.csv", [
      ["SKU", "Name", "Category", "UOM", "GST Rate (%)", "Selling Price", "Standard Cost", "Reorder Level"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredItems.length} items to CSV`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title={itemsLabel}
        subtitle="Catalog, pricing rules, tax rates, inventory reorder thresholds, and dynamic specifications."
        badge={{ label: `${items.length} SKUs`, variant: "outline" }}
        primaryAction={{
          label: showForm ? "Cancel" : `Add ${itemLabel}`,
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export Catalog",
            icon: Download,
            onClick: handleExportCsv,
            disabled: items.length === 0,
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Context KPI Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention / Exceptions */}
      <AttentionPanel items={attentionItems} />

      {/* Create Item Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">New {itemLabel}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define SKU code, base unit, GST rate, selling price, and category parameters.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-sku">SKU Code *</Label>
                <Input
                  id="item-sku"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                  placeholder="e.g. TMT-12MM-FE500D"
                  autoFocus
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-name">Item Name *</Label>
                <Input
                  id="item-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={nameExample}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-category">Category</Label>
                <select
                  id="item-category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-uom">Base Unit</Label>
                <Input
                  id="item-uom"
                  value={form.base_uom}
                  onChange={(e) => setForm((f) => ({ ...f, base_uom: e.target.value.toUpperCase() }))}
                  placeholder={uomExample}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-gst">GST %</Label>
                <Input
                  id="item-gst"
                  type="number"
                  value={form.gst_rate}
                  onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-price">Selling Price (₹)</Label>
                <Input
                  id="item-price"
                  type="number"
                  value={form.standard_price}
                  onChange={(e) => setForm((f) => ({ ...f, standard_price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-cost">Standard Cost (₹)</Label>
                <Input
                  id="item-cost"
                  type="number"
                  value={form.standard_cost}
                  onChange={(e) => setForm((f) => ({ ...f, standard_cost: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-reorder">Reorder Threshold Level</Label>
                <Input
                  id="item-reorder"
                  type="number"
                  value={form.reorder_level}
                  onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                  placeholder="Not tracked"
                />
              </div>
              <DynamicAttributesFieldset
                schema={selectedCategory?.parameter_schema ?? []}
                value={attributes}
                onChange={setAttributes}
              />
            </div>
            {createItem.isError && <ErrorState error={createItem.error} />}
            <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createItem.mutate()}
                disabled={!form.sku || !form.name || createItem.isPending}
              >
                {createItem.isPending ? "Saving..." : `Save ${itemLabel}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Pills & Auto-Categorization */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Category Taxonomy</CardTitle>
            </div>
            {profile?.slug === "building_materials" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setAutoCategorizeStatus(null);
                  autoCategorize.mutate();
                }}
                disabled={autoCategorize.isPending || uncategorizedCount === 0}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                {autoCategorize.isPending
                  ? "Categorizing..."
                  : `Auto-categorize by SKU prefix (${uncategorizedCount})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                categoryFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              All Categories ({items.length})
            </button>
            <button
              onClick={() => setCategoryFilter("uncategorized")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                categoryFilter === "uncategorized"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-dashed border-amber-400 text-amber-600 hover:bg-accent"
              )}
            >
              Uncategorized ({uncategorizedCount})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  categoryFilter === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {c.name} ({items.filter((i) => i.category_id === c.id).length})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2.5">
            <Input
              placeholder="Create new category..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && newCategoryName && createCategory.mutate(newCategoryName)
              }
              className="h-8 w-48 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => createCategory.mutate(newCategoryName)}
              disabled={!newCategoryName || createCategory.isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Category
            </Button>
            {autoCategorizeStatus && (
              <p className="text-xs text-muted-foreground ml-2">{autoCategorizeStatus}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: `All ${itemsLabel}`, count: items.length },
          { id: "priced", label: "Priced", count: items.length - zeroPriceCount },
          { id: "zero_price", label: "Missing Price", count: zeroPriceCount },
          { id: "uncategorized", label: "Uncategorized", count: uncategorizedCount },
          { id: "reorder", label: "Reorder Tracked", count: withReorderLevel },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={`Search ${itemsLabel.toLowerCase()} by name, SKU...`}
        hasActiveFilters={Boolean(q || activeView !== "all" || categoryFilter !== "all")}
        onClearFilters={() => {
          setQ("");
          setActiveView("all");
          setCategoryFilter("all");
        }}
      />

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty States */}
      {!isLoading && items.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Package}
          title={`No ${itemsLabel.toLowerCase()} recorded yet`}
          description={`Add your first ${itemLabel.toLowerCase()} with SKU and pricing, or import your catalog from Tally or Busy.`}
          tip="Items power quotations, orders, warehouse batches, and inventory ledgers."
          primaryAction={{
            label: `Add ${itemLabel}`,
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
          secondaryActions={[
            {
              label: "Import Catalog",
              href: "/settings/imports",
            },
          ]}
        />
      )}

      {!isLoading && items.length > 0 && filteredItems.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title={`No ${itemsLabel.toLowerCase()} match your filters`}
          description={`No catalog items match view "${activeView}" or current category selection.`}
          primaryAction={{
            label: "Reset All Filters",
            onClick: () => {
              setActiveView("all");
              setCategoryFilter("all");
              setQ("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="w-12 p-3"><span className="sr-only">Photo</span></th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">GST Rate</th>
                  <th className="p-3">Selling Price</th>
                  <th className="p-3 text-right">Standard Cost</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isZeroPrice = Number(item.standard_price) === 0;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5",
                        isZeroPrice && "bg-amber-50/20 dark:bg-amber-950/10"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>

                      <td className="p-3">
                        <ItemImageCell item={item} />
                      </td>

                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.sku}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="font-semibold text-foreground hover:text-primary hover:underline text-left block"
                        >
                          {item.name}
                        </button>
                      </td>

                      <td className="p-3">
                        <CategorySelect item={item} categories={categories} />
                      </td>

                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {item.base_uom}
                      </td>

                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {item.gst_rate}%
                        </Badge>
                      </td>

                      <td className="p-3">
                        <EditablePrice item={item} />
                      </td>

                      <td className="p-3 text-right text-xs text-muted-foreground font-mono">
                        {formatINR(item.standard_cost)}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewItem(item),
                            },
                          ]}
                          actions={[
                            {
                              id: "stock-ledger",
                              label: "Stock Movements",
                              icon: ArrowRight,
                              onClick: () => {
                                window.location.href = `/stock-ledger?item_id=${item.id}`;
                              },
                            },
                            {
                              id: "batches",
                              label: "View Batches",
                              icon: Layers,
                              onClick: () => {
                                window.location.href = `/batches`;
                              },
                            },
                            {
                              id: "copy-sku",
                              label: "Copy SKU",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(item.sku);
                                toast.success(`Copied ${item.sku}`);
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        totalCount={filteredItems.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedItems = items.filter((i) => selectedIds.includes(i.id));
              downloadCsv("materialos_selected_items.csv", [
                ["SKU", "Name", "Category", "UOM", "Price", "Cost"],
                ...selectedItems.map((i) => [
                  i.sku,
                  i.name,
                  categories.find((c) => c.id === i.category_id)?.name ?? "Uncategorized",
                  i.base_uom,
                  i.standard_price,
                  i.standard_cost,
                ]),
              ]);
              toast.success(`Exported ${selectedItems.length} items`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewItem && (
        <DetailDrawer
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          title={previewItem.name}
          subtitle={`SKU: ${previewItem.sku} · ${previewItem.base_uom}`}
          statusBadge={
            Number(previewItem.standard_price) > 0
              ? { label: "Priced", variant: "success" }
              : { label: "Zero Price", variant: "destructive" }
          }
          primaryAction={{
            label: "Stock Movements",
            href: `/stock-ledger?item_id=${previewItem.id}`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Standard Price</p>
                <p className="text-base font-bold font-mono mt-0.5 text-foreground">
                  {formatINR(previewItem.standard_price)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Standard Cost</p>
                <p className="text-base font-bold font-mono mt-0.5 text-muted-foreground">
                  {formatINR(previewItem.standard_cost)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">GST Slab</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewItem.gst_rate}%
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Reorder Threshold</p>
                <p className="font-semibold text-foreground mt-0.5 font-mono">
                  {previewItem.reorder_level ? `${previewItem.reorder_level} ${previewItem.base_uom}` : "Not tracked"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Classification</p>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Category:</span>
                <span className="font-medium text-foreground">
                  {categories.find((c) => c.id === previewItem.category_id)?.name ?? "Uncategorized"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Brand:</span>
                <span className="font-medium text-foreground">
                  {previewItem.brand ?? "Unbranded / Commodity"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Related Workflows</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/stock-ledger?item_id=${previewItem.id}`}>
                    <ArrowRight className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>View Stock Movements for this Item</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/batches`}>
                    <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>View Batches & Lots</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/purchase-orders`}>
                    <WarehouseIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Draft Purchase Order to Restock</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
