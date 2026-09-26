import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Download,
  Eye,
  Filter,
  Layers,
  Package,
  RefreshCw,
  TrendingDown,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
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

interface StockLedgerEntry {
  id: string;
  item_id: string;
  warehouse_id: string;
  movement_type: string;
  qty: string;
  rate: string;
  value: string;
  reference_type: string;
  occurred_at: string;
}

interface Item {
  id: string;
  name: string;
  sku?: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  opening: "Opening stock",
  purchase: "Purchase receipt",
  sale: "Sales dispatch",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  adjustment: "Physical count adjustment",
  sales_return: "Customer return",
  purchase_return: "Vendor return",
};

const MOVEMENT_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }
> = {
  opening: { label: "Opening", variant: "outline" },
  purchase: { label: "Purchase", variant: "success" },
  sale: { label: "Dispatch", variant: "secondary" },
  transfer_in: { label: "Transfer In", variant: "outline" },
  transfer_out: { label: "Transfer Out", variant: "outline" },
  adjustment: { label: "Adjustment", variant: "destructive" },
  sales_return: { label: "Sales Return", variant: "destructive" },
  purchase_return: { label: "Vendor Return", variant: "outline" },
};

export function StockMovementsPage() {
  const [searchParams] = useSearchParams();
  const initialItemId = searchParams.get("item_id") ?? "";

  const [itemId, setItemId] = useState(initialItemId);
  const [warehouseId, setWarehouseId] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewEntry, setPreviewEntry] = useState<StockLedgerEntry | null>(null);

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => apiFetch<Item[]>("/items"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });

  const {
    data: movements = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["stock-ledger", itemId, warehouseId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (itemId) params.set("item_id", itemId);
      if (warehouseId) params.set("warehouse_id", warehouseId);
      const qs = params.toString();
      return apiFetch<StockLedgerEntry[]>(`/stock-ledger${qs ? `?${qs}` : ""}`);
    },
  });

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i.name])), [items]);
  const warehouseById = useMemo(
    () => new Map((warehouses ?? []).map((w) => [w.id, w.name])),
    [warehouses]
  );

  // Business calculations
  const {
    inboundCount,
    outboundCount,
    adjustmentsCount,
    returnsCount,
    largeAdjustments,
    totalMovedValue,
    highValueCount,
  } = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    let adj = 0;
    let ret = 0;
    let largeAdj = 0;
    let totalVal = 0;
    let highVal = 0;

    for (const m of movements) {
      const val = Math.abs(Number(m.value)) || 0;
      const qty = Number(m.qty) || 0;
      totalVal += val;

      if (val >= 50000) highVal++;

      if (
        m.movement_type === "purchase" ||
        m.movement_type === "transfer_in" ||
        m.movement_type === "opening"
      ) {
        inbound++;
      } else if (
        m.movement_type === "sale" ||
        m.movement_type === "transfer_out"
      ) {
        outbound++;
      } else if (m.movement_type === "adjustment") {
        adj++;
        if (Math.abs(qty) > 50 || val > 25000) {
          largeAdj++;
        }
      } else if (
        m.movement_type === "sales_return" ||
        m.movement_type === "purchase_return"
      ) {
        ret++;
      }
    }

    return {
      inboundCount: inbound,
      outboundCount: outbound,
      adjustmentsCount: adj,
      returnsCount: ret,
      largeAdjustments: largeAdj,
      totalMovedValue: totalVal,
      highValueCount: highVal,
    };
  }, [movements]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Movements",
        value: movements.length,
        sublabel: "Across all godowns",
        icon: ArrowLeftRight,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "inbound",
        label: "Inbound Stock",
        value: inboundCount,
        sublabel: "Receipts & transfers in",
        icon: ArrowDownLeft,
        color: "emerald",
        active: activeView === "inbound",
        onClick: () => setActiveView("inbound"),
      },
      {
        id: "outbound",
        label: "Outbound Dispatches",
        value: outboundCount,
        sublabel: "Sales & transfers out",
        icon: ArrowUpRight,
        color: "sky",
        active: activeView === "outbound",
        onClick: () => setActiveView("outbound"),
      },
      {
        id: "adjustments",
        label: "Count Adjustments",
        value: adjustmentsCount,
        sublabel: `${largeAdjustments} high deviation`,
        icon: AlertTriangle,
        color: adjustmentsCount > 0 ? "amber" : "slate",
        active: activeView === "adjustments",
        onClick: () => setActiveView("adjustments"),
      },
      {
        id: "returns",
        label: "Returns & Exchanges",
        value: returnsCount,
        sublabel: "Customer & vendor returns",
        icon: TrendingDown,
        color: returnsCount > 0 ? "rose" : "slate",
        active: activeView === "returns",
        onClick: () => setActiveView("returns"),
      },
      {
        id: "value",
        label: "Gross Throughput",
        value: formatINRCompact(totalMovedValue),
        sublabel: `${highValueCount} high-value entries`,
        icon: Package,
        color: "indigo",
      },
    ],
    [
      movements.length,
      inboundCount,
      outboundCount,
      adjustmentsCount,
      largeAdjustments,
      returnsCount,
      totalMovedValue,
      highValueCount,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (largeAdjustments > 0) {
      items.push({
        id: "att-large-adj",
        title: `${largeAdjustments} unusually large stock adjustment${largeAdjustments > 1 ? "s" : ""}`,
        severity: "warning",
        count: largeAdjustments,
        description: "Physical count discrepancies exceeding threshold. Requires audit review.",
        actionLabel: "Filter adjustments",
        onClick: () => setActiveView("adjustments"),
      });
    }

    if (returnsCount > 0) {
      items.push({
        id: "att-returns",
        title: `${returnsCount} return movement${returnsCount > 1 ? "s" : ""} recorded`,
        severity: "info",
        count: returnsCount,
        description: "Customer or supplier returns awaiting QC inspection and restocking.",
        actionLabel: "Review returns",
        onClick: () => setActiveView("returns"),
      });
    }

    return items;
  }, [largeAdjustments, returnsCount]);

  // Views & Filter logic
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Saved views
      if (activeView === "inbound") {
        if (
          m.movement_type !== "purchase" &&
          m.movement_type !== "transfer_in" &&
          m.movement_type !== "opening"
        ) {
          return false;
        }
      } else if (activeView === "outbound") {
        if (
          m.movement_type !== "sale" &&
          m.movement_type !== "transfer_out"
        ) {
          return false;
        }
      } else if (activeView === "transfers") {
        if (
          m.movement_type !== "transfer_in" &&
          m.movement_type !== "transfer_out"
        ) {
          return false;
        }
      } else if (activeView === "adjustments") {
        if (m.movement_type !== "adjustment") return false;
      } else if (activeView === "returns") {
        if (
          m.movement_type !== "sales_return" &&
          m.movement_type !== "purchase_return"
        ) {
          return false;
        }
      } else if (activeView === "high_value") {
        if (Math.abs(Number(m.value)) < 50000) return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const itemName = (itemById.get(m.item_id) ?? "").toLowerCase();
        const whName = (warehouseById.get(m.warehouse_id) ?? "").toLowerCase();
        const typeLabel = (MOVEMENT_LABELS[m.movement_type] ?? m.movement_type).toLowerCase();
        const refType = (m.reference_type ?? "").toLowerCase();

        if (
          !itemName.includes(q) &&
          !whName.includes(q) &&
          !typeLabel.includes(q) &&
          !refType.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [movements, activeView, search, itemById, warehouseById]);

  // Selection
  function toggleSelectAll() {
    if (selectedIds.length === filteredMovements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMovements.map((m) => m.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredMovements.map((m) => [
      new Date(m.occurred_at).toISOString(),
      itemById.get(m.item_id) ?? m.item_id,
      warehouseById.get(m.warehouse_id) ?? m.warehouse_id,
      MOVEMENT_LABELS[m.movement_type] ?? m.movement_type,
      m.qty,
      m.rate,
      m.value,
      m.reference_type ?? "",
    ]);
    downloadCsv("materialos_stock_ledger.csv", [
      ["Timestamp", "Item", "Warehouse", "Movement Type", "Qty", "Rate", "Value", "Reference Type"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredMovements.length} stock ledger movements`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Stock Control & Ledger"
        subtitle="Complete audit trail of inventory transactions, godown transfers, and count reconciliations."
        badge={{ label: `${movements.length} Movements`, variant: "outline" }}
        secondaryActions={[
          {
            label: "Export Ledger",
            icon: Download,
            onClick: handleExportCsv,
            disabled: movements.length === 0,
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

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Movements", count: movements.length },
          { id: "inbound", label: "Inbound", count: inboundCount },
          { id: "outbound", label: "Outbound", count: outboundCount },
          { id: "transfers", label: "Transfers" },
          { id: "adjustments", label: "Adjustments", count: adjustmentsCount },
          { id: "returns", label: "Returns", count: returnsCount },
          { id: "high_value", label: "High Value (≥₹50k)" },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search item, location, movement type..."
        hasActiveFilters={Boolean(itemId || warehouseId || search || activeView !== "all")}
        onClearFilters={() => {
          setItemId("");
          setWarehouseId("");
          setSearch("");
          setActiveView("all");
        }}
      >
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
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
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          aria-label="Filter by item"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium max-w-[150px] truncate"
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
      {!isLoading && movements.length === 0 && (
        <SmartEmptyState
          type="operational"
          icon={ArrowLeftRight}
          title="No stock movements recorded"
          description="Stock movements are automatically recorded when purchases are received, sales orders are dispatched, or transfers are completed."
          tip="All changes to inventory maintain an immutable audit trail."
        />
      )}

      {!isLoading && movements.length > 0 && filteredMovements.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No movements match your criteria"
          description={`No transactions found matching the "${activeView}" view and active filters.`}
          primaryAction={{
            label: "Reset All Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
              setItemId("");
              setWarehouseId("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredMovements.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredMovements.length && filteredMovements.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Item</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Unit Rate</th>
                  <th className="p-3 text-right">Total Value</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMovements.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  const qty = Number(m.qty);
                  const isNegative = qty < 0;
                  const isAdjustment = m.movement_type === "adjustment";
                  const badgeInfo = MOVEMENT_BADGES[m.movement_type] ?? {
                    label: m.movement_type,
                    variant: "outline" as const,
                  };

                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5",
                        isAdjustment && "bg-amber-50/20 dark:bg-amber-950/10"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(m.id)}
                          aria-label={`Select transaction ${m.id}`}
                        />
                      </td>

                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.occurred_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="p-3 font-medium text-foreground">
                        <button
                          type="button"
                          onClick={() => setPreviewEntry(m)}
                          className="hover:text-primary hover:underline text-left"
                        >
                          {itemById.get(m.item_id) ?? <span className="text-muted-foreground">—</span>}
                        </button>
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <WarehouseIcon className="h-3.5 w-3.5 opacity-70" />
                          <span>{warehouseById.get(m.warehouse_id) ?? "—"}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <Badge variant={badgeInfo.variant} className="text-[11px] font-medium">
                          {badgeInfo.label}
                        </Badge>
                      </td>

                      <td
                        className={cn(
                          "p-3 text-right font-semibold font-mono text-xs",
                          isNegative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {qty > 0 ? `+${qty.toLocaleString("en-IN")}` : qty.toLocaleString("en-IN")}
                      </td>

                      <td className="p-3 text-right text-xs text-muted-foreground font-mono">
                        {formatINR(m.rate)}
                      </td>

                      <td className="p-3 text-right font-medium font-mono text-xs">
                        {formatINR(m.value)}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewEntry(m),
                            },
                          ]}
                          actions={[
                            {
                              id: "filter-item",
                              label: "Show Only This Item",
                              icon: Filter,
                              onClick: () => setItemId(m.item_id),
                            },
                            {
                              id: "filter-wh",
                              label: "Show Only This Warehouse",
                              icon: WarehouseIcon,
                              onClick: () => setWarehouseId(m.warehouse_id),
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
        totalCount={filteredMovements.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedMovements = movements.filter((m) => selectedIds.includes(m.id));
              downloadCsv("materialos_selected_movements.csv", [
                ["Timestamp", "Item", "Warehouse", "Movement Type", "Qty", "Rate", "Value"],
                ...selectedMovements.map((m) => [
                  m.occurred_at,
                  itemById.get(m.item_id) ?? "",
                  warehouseById.get(m.warehouse_id) ?? "",
                  MOVEMENT_LABELS[m.movement_type] ?? m.movement_type,
                  m.qty,
                  m.rate,
                  m.value,
                ]),
              ]);
              toast.success(`Exported ${selectedMovements.length} movements`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewEntry && (
        <DetailDrawer
          open={!!previewEntry}
          onOpenChange={(open) => !open && setPreviewEntry(null)}
          title={itemById.get(previewEntry.item_id) ?? "Stock Movement"}
          subtitle={`Transaction ID: ${previewEntry.id}`}
          statusBadge={{
            label: MOVEMENT_LABELS[previewEntry.movement_type] ?? previewEntry.movement_type,
            variant: MOVEMENT_BADGES[previewEntry.movement_type]?.variant ?? "outline",
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Quantity Changed</p>
                <p
                  className={cn(
                    "text-base font-bold font-mono mt-0.5",
                    Number(previewEntry.qty) < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {Number(previewEntry.qty) > 0 ? `+${previewEntry.qty}` : previewEntry.qty}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Transaction Value</p>
                <p className="text-base font-bold font-mono mt-0.5">
                  {formatINR(previewEntry.value)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Warehouse / Godown</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {warehouseById.get(previewEntry.warehouse_id) ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Applied Rate</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {formatINR(previewEntry.rate)} / unit
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Audit Record</p>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Occurred At:</span>
                <span className="font-medium text-foreground">
                  {new Date(previewEntry.occurred_at).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Reference Type:</span>
                <span className="font-medium text-foreground">
                  {previewEntry.reference_type || "Direct Stock Transaction"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Related Workflows</p>
              <div className="flex flex-col gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                >
                  <Link
                    to={`/batches`}
                    onClick={() => setPreviewEntry(null)}
                  >
                    <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Inspect Item Batches</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                >
                  <Link
                    to={`/transfers`}
                    onClick={() => setPreviewEntry(null)}
                  >
                    <ArrowLeftRight className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Initiate Inter-Warehouse Transfer</span>
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
