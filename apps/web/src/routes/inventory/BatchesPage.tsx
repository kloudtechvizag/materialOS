import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { QuickAddItemModal } from "@/components/entities/QuickAddItemModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
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
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  item_id: string;
  warehouse_id: string;
  batch_code: string;
  manufactured_on: string | null;
  expiry_date: string | null;
  heat_number: string | null;
  cost: string;
}

interface Item {
  id: string;
  name: string;
  sku: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  item_id: "",
  warehouse_id: "",
  batch_code: "",
  manufactured_on: "",
  expiry_date: "",
  heat_number: "",
  cost: "0",
};

export function BatchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewBatch, setPreviewBatch] = useState<Batch | null>(null);

  // Quick add states for inline creation
  const [quickAddItemOpen, setQuickAddItemOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => apiFetch<Item[]>("/items"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });
  const { data: batches = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["batches"],
    queryFn: () => apiFetch<Batch[]>("/batches"),
  });

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i.name])), [items]);
  const warehouseById = useMemo(() => new Map((warehouses ?? []).map((w) => [w.id, w.name])), [warehouses]);

  const createBatch = useMutation({
    mutationFn: () =>
      apiFetch<Batch>("/batches", {
        method: "POST",
        body: {
          ...form,
          manufactured_on: form.manufactured_on || null,
          expiry_date: form.expiry_date || null,
          heat_number: form.heat_number.trim() || null,
        },
      }),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast.success(`Batch ${newBatch.batch_code} registered`);
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  // Business calculations
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const thirtyDaysOut = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }, []);

  const {
    activeBatches,
    expiringSoonBatches,
    expiredBatches,
    missingMtcBatches,
    totalValue,
  } = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let missingMtc = 0;
    let val = 0;

    for (const b of batches) {
      val += Number(b.cost) || 0;
      if (!b.heat_number) missingMtc++;

      if (b.expiry_date) {
        if (b.expiry_date < today) {
          expired++;
        } else if (b.expiry_date <= thirtyDaysOut) {
          expiring++;
          active++;
        } else {
          active++;
        }
      } else {
        active++;
      }
    }

    return {
      activeBatches: active,
      expiringSoonBatches: expiring,
      expiredBatches: expired,
      missingMtcBatches: missingMtc,
      totalValue: val,
    };
  }, [batches, today, thirtyDaysOut]);

  // Metric strip data
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Batches",
        value: batches.length,
        sublabel: `${activeBatches} active lots`,
        icon: Layers,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "expiring",
        label: "Expiring Soon",
        value: expiringSoonBatches,
        sublabel: "Next 30 days (FEFO)",
        icon: AlertTriangle,
        color: "amber",
        active: activeView === "expiring",
        onClick: () => setActiveView("expiring"),
      },
      {
        id: "expired",
        label: "Expired Batches",
        value: expiredBatches,
        sublabel: "Critical compliance risk",
        icon: ShieldAlert,
        color: "rose",
        active: activeView === "expired",
        onClick: () => setActiveView("expired"),
      },
      {
        id: "mtc",
        label: "Missing MTC / Heat",
        value: missingMtcBatches,
        sublabel: "Steel traceability gap",
        icon: FileText,
        color: "orange",
        active: activeView === "missing_mtc",
        onClick: () => setActiveView("missing_mtc"),
      },
      {
        id: "value",
        label: "Recorded Value",
        value: formatINRCompact(totalValue),
        sublabel: `${warehouses?.length ?? 1} storage locations`,
        icon: Package,
        color: "emerald",
      },
    ],
    [
      batches.length,
      activeBatches,
      expiringSoonBatches,
      expiredBatches,
      missingMtcBatches,
      totalValue,
      activeView,
      warehouses?.length,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    if (expiredBatches > 0) {
      items.push({
        id: "att-expired",
        title: `${expiredBatches} expired batch${expiredBatches > 1 ? "es" : ""}`,
        severity: "critical",
        count: expiredBatches,
        description: "Quarantine or scrap immediately to prevent unlawful dispatch.",
        actionLabel: "Filter expired lots",
        onClick: () => setActiveView("expired"),
      });
    }
    if (expiringSoonBatches > 0) {
      items.push({
        id: "att-expiring",
        title: `${expiringSoonBatches} batch${expiringSoonBatches > 1 ? "es" : ""} nearing expiry`,
        severity: "warning",
        count: expiringSoonBatches,
        description: "Prioritize sales dispatch using First-Expired-First-Out (FEFO).",
        actionLabel: "Review FEFO priority",
        onClick: () => setActiveView("expiring"),
      });
    }
    if (missingMtcBatches > 0) {
      items.push({
        id: "att-mtc",
        title: `${missingMtcBatches} batch${missingMtcBatches > 1 ? "es" : ""} missing heat / MTC`,
        severity: "info",
        count: missingMtcBatches,
        description: "Required for ISI/BIS steel compliance test certificates.",
        actionLabel: "View unallocated MTCs",
        onClick: () => setActiveView("missing_mtc"),
      });
    }
    return items;
  }, [expiredBatches, expiringSoonBatches, missingMtcBatches]);

  // Views & Filtering
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // View filters
      if (activeView === "active" && b.expiry_date && b.expiry_date < today) return false;
      if (activeView === "expiring" && (!b.expiry_date || b.expiry_date < today || b.expiry_date > thirtyDaysOut)) return false;
      if (activeView === "expired" && (!b.expiry_date || b.expiry_date >= today)) return false;
      if (activeView === "heat_tracked" && !b.heat_number) return false;
      if (activeView === "missing_mtc" && b.heat_number) return false;

      // Warehouse filter
      if (selectedWarehouse && b.warehouse_id !== selectedWarehouse) return false;

      // Item filter
      if (selectedItem && b.item_id !== selectedItem) return false;

      // Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const itemName = (itemById.get(b.item_id) ?? "").toLowerCase();
        const whName = (warehouseById.get(b.warehouse_id) ?? "").toLowerCase();
        const heat = (b.heat_number ?? "").toLowerCase();
        const code = b.batch_code.toLowerCase();
        if (!code.includes(q) && !itemName.includes(q) && !whName.includes(q) && !heat.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [batches, activeView, selectedWarehouse, selectedItem, search, today, thirtyDaysOut, itemById, warehouseById]);

  // Selection handlers
  function toggleSelectAll() {
    if (selectedIds.length === filteredBatches.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBatches.map((b) => b.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredBatches.map((b) => [
      b.batch_code,
      itemById.get(b.item_id) ?? b.item_id,
      warehouseById.get(b.warehouse_id) ?? b.warehouse_id,
      b.heat_number ?? "",
      b.manufactured_on ?? "",
      b.expiry_date ?? "",
      b.cost,
    ]);
    downloadCsv("materialos_batches.csv", [
      ["Batch Code", "Item", "Warehouse", "Heat Number", "Manufactured On", "Expiry Date", "Unit Cost"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredBatches.length} batch records to CSV`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Batches & Lots"
        subtitle="Traceability register for lots, expiry schedules, and mill test certificate (MTC) heat numbers."
        badge={{ label: `${batches.length} Total`, variant: "outline" }}
        primaryAction={{
          label: showForm ? "Cancel" : "Add Batch",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: batches.length === 0,
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

      {/* Create Batch Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">New Batch Registration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link an item to warehouse inventory with manufacturing lot and steel heat numbers.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Item *</Label>
                <SearchableSelect
                  options={items?.map((i) => ({ id: i.id, label: i.name, sublabel: i.sku }))}
                  value={form.item_id}
                  onChange={(val) => setForm((f) => ({ ...f, item_id: val }))}
                  placeholder="Select item..."
                  searchPlaceholder="Search items or SKU..."
                  quickAddLabel="Quick Add Item"
                  onQuickAdd={() => setQuickAddItemOpen(true)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Warehouse *</Label>
                <SearchableSelect
                  options={warehouses?.map((w) => ({ id: w.id, label: w.name }))}
                  value={form.warehouse_id}
                  onChange={(val) => setForm((f) => ({ ...f, warehouse_id: val }))}
                  placeholder="Select warehouse..."
                  searchPlaceholder="Search locations..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Batch / Lot Code *</Label>
                <Input
                  value={form.batch_code}
                  onChange={(e) => setForm((f) => ({ ...f, batch_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B-2026-09-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Heat Number (MTC / Steel)</Label>
                <Input
                  value={form.heat_number}
                  onChange={(e) => setForm((f) => ({ ...f, heat_number: e.target.value.toUpperCase() }))}
                  placeholder="e.g. HT-78491"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Manufactured On</Label>
                <Input
                  type="date"
                  value={form.manufactured_on}
                  onChange={(e) => setForm((f) => ({ ...f, manufactured_on: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
              </div>
            </div>

            {createBatch.isError && (
              <div className="mt-4">
                <ErrorState error={createBatch.error} />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createBatch.mutate()}
                disabled={!form.item_id || !form.warehouse_id || !form.batch_code || createBatch.isPending}
              >
                {createBatch.isPending ? "Registering..." : "Save Batch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Batches", count: batches.length },
          { id: "active", label: "Active", count: activeBatches },
          { id: "expiring", label: "Expiring Soon", count: expiringSoonBatches },
          { id: "expired", label: "Expired", count: expiredBatches },
          { id: "heat_tracked", label: "Heat Tracked", count: batches.length - missingMtcBatches },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search batch code, item, heat..."
        hasActiveFilters={Boolean(selectedWarehouse || selectedItem || search || activeView !== "all")}
        onClearFilters={() => {
          setSelectedWarehouse("");
          setSelectedItem("");
          setSearch("");
          setActiveView("all");
        }}
      >
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          aria-label="Filter by warehouse"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
        >
          <option value="">All Warehouses</option>
          {warehouses?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value)}
          aria-label="Filter by item"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium max-w-[140px] truncate"
        >
          <option value="">All Items</option>
          {items?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </SavedViews>

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
      {!isLoading && batches.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Layers}
          title="No batches recorded yet"
          description="Create your first batch to track lot numbers, expiry dates, and heat numbers across warehouses."
          tip="Batches enable First-Expired-First-Out (FEFO) and mill test certificates."
          primaryAction={{
            label: "Create First Batch",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {!isLoading && batches.length > 0 && filteredBatches.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No batches match your filter"
          description={`No records found matching the "${activeView}" view and current search terms.`}
          primaryAction={{
            label: "Clear All Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
              setSelectedWarehouse("");
              setSelectedItem("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredBatches.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredBatches.length && filteredBatches.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Batch Code</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Heat / MTC</th>
                  <th className="p-3">Manufactured</th>
                  <th className="p-3">Expiry Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBatches.map((b) => {
                  const isSelected = selectedIds.includes(b.id);
                  const isExpired = b.expiry_date && b.expiry_date < today;
                  const isExpiringSoon =
                    b.expiry_date && !isExpired && b.expiry_date <= thirtyDaysOut;

                  return (
                    <tr
                      key={b.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5",
                        isExpired && "bg-rose-50/30 dark:bg-rose-950/10"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(b.id)}
                          aria-label={`Select ${b.batch_code}`}
                        />
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setPreviewBatch(b)}
                          className="font-semibold text-primary hover:underline text-left"
                        >
                          {b.batch_code}
                        </button>
                      </td>

                      <td className="p-3 font-medium text-foreground">
                        {itemById.get(b.item_id) ?? <span className="text-muted-foreground">—</span>}
                      </td>

                      <td className="p-3 text-muted-foreground flex items-center gap-1.5 pt-4">
                        <WarehouseIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span>{warehouseById.get(b.warehouse_id) ?? "—"}</span>
                      </td>

                      <td className="p-3">
                        {b.heat_number ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {b.heat_number}
                          </Badge>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Missing MTC
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        {b.manufactured_on ? (
                          new Date(b.manufactured_on).toLocaleDateString("en-IN")
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="p-3">
                        {isExpired ? (
                          <Badge variant="destructive" className="text-xs">
                            Expired ({b.expiry_date})
                          </Badge>
                        ) : isExpiringSoon ? (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            Expiring ({b.expiry_date})
                          </Badge>
                        ) : b.expiry_date ? (
                          <span className="text-xs text-muted-foreground">
                            {b.expiry_date}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No expiry</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewBatch(b),
                            },
                          ]}
                          actions={[
                            {
                              id: "copy",
                              label: "Copy Batch Code",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(b.batch_code);
                                toast.success(`Copied ${b.batch_code}`);
                              },
                            },
                            {
                              id: "stock-ledger",
                              label: "View Stock Movements",
                              icon: ArrowRight,
                              onClick: () => {
                                window.location.href = `/stock-ledger?item_id=${b.item_id}`;
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
        totalCount={filteredBatches.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));
              downloadCsv("materialos_selected_batches.csv", [
                ["Batch Code", "Item", "Warehouse", "Heat Number", "Expiry"],
                ...selectedBatches.map((b) => [
                  b.batch_code,
                  itemById.get(b.item_id) ?? "",
                  warehouseById.get(b.warehouse_id) ?? "",
                  b.heat_number ?? "",
                  b.expiry_date ?? "",
                ]),
              ]);
              toast.success(`Exported ${selectedBatches.length} selected batches`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewBatch && (
        <DetailDrawer
          open={!!previewBatch}
          onOpenChange={(open) => !open && setPreviewBatch(null)}
          title={`Batch ${previewBatch.batch_code}`}
          subtitle={`Item ID: ${previewBatch.item_id}`}
          statusBadge={
            previewBatch.expiry_date && previewBatch.expiry_date < today
              ? { label: "Expired", variant: "destructive" }
              : previewBatch.expiry_date && previewBatch.expiry_date <= thirtyDaysOut
              ? { label: "Expiring Soon", variant: "secondary" }
              : { label: "Active Lot", variant: "success" }
          }
          primaryAction={{
            label: "Copy Code",
            onClick: () => {
              navigator.clipboard.writeText(previewBatch.batch_code);
              toast.success(`Copied ${previewBatch.batch_code}`);
            },
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Item Name</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {itemById.get(previewBatch.item_id) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Warehouse</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {warehouseById.get(previewBatch.warehouse_id) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Heat / MTC Number</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewBatch.heat_number ?? "None (Missing)"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost per Unit</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {formatINR(previewBatch.cost)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Traceability Schedule</p>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Manufacture Date:</span>
                <span className="font-medium text-foreground">
                  {previewBatch.manufactured_on ?? "Not recorded"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Expiry Date:</span>
                <span className="font-medium text-foreground">
                  {previewBatch.expiry_date ?? "No expiry specified"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Related Movements & Stock</p>
              <p className="text-xs text-muted-foreground">
                View transactions in the Stock Ledger that reference this batch.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={`/stock-ledger?item_id=${previewBatch.item_id}`}>
                  <span>Inspect Stock Movements</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* Inline Quick Add Item Modal */}
      <QuickAddItemModal
        open={quickAddItemOpen}
        onOpenChange={setQuickAddItemOpen}
        onCreated={(newItem) => {
          queryClient.invalidateQueries({ queryKey: ["items"] });
          setForm((f) => ({ ...f, item_id: newItem.id }));
        }}
      />
    </div>
  );
}
