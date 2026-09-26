import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Plus,
  RefreshCw,
  Truck,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ItemSelect } from "@/components/items/ItemSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import type { CategoryLite } from "@/lib/items";

interface Warehouse {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  category_id: string | null;
  sku?: string;
  uom?: string;
}

interface TransferItem {
  id: string;
  item_id: string;
  qty: string | number;
}

interface Transfer {
  id: string;
  number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  created_at?: string;
  items?: TransferItem[];
}

export function TransfersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => apiFetch<Item[]>("/items"),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<CategoryLite[]>("/categories"),
  });

  const {
    data: transfers,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => apiFetch<Transfer[]>("/transfers"),
  });

  function warehouseName(id: string) {
    return warehouses?.find((w) => w.id === id)?.name ?? id;
  }

  function itemName(id: string) {
    return items?.find((i) => i.id === id)?.name ?? id;
  }

  const createTransfer = useMutation({
    mutationFn: () =>
      apiFetch<Transfer>("/transfers", {
        method: "POST",
        body: {
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          lines: [{ item_id: itemId, qty: Number(qty) }],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Stock transfer request created successfully");
      setShowForm(false);
      setFromId("");
      setToId("");
      setItemId("");
      setQty("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create transfer");
    },
  });

  const dispatch = useMutation({
    mutationFn: (id: string) => apiFetch(`/transfers/${id}/dispatch`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer marked as dispatched (in-transit)");
      if (selectedTransfer) {
        setSelectedTransfer((prev) => (prev ? { ...prev, status: "dispatched" } : null));
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to dispatch transfer");
    },
  });

  const receive = useMutation({
    mutationFn: (id: string) => apiFetch(`/transfers/${id}/receive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Stock received and updated at destination warehouse");
      if (selectedTransfer) {
        setSelectedTransfer((prev) => (prev ? { ...prev, status: "received" } : null));
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to receive transfer");
    },
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!transfers) return [];
    const total = transfers.length;
    const requested = transfers.filter((t) => t.status === "requested").length;
    const dispatched = transfers.filter((t) => t.status === "dispatched").length;
    const received = transfers.filter((t) => t.status === "received").length;

    return [
      {
        id: "total",
        label: "Total Transfers",
        value: total,
        sublabel: "Lifetime volume",
        icon: ArrowLeftRight,
        color: "primary",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "requested",
        label: "Pending Dispatch",
        value: requested,
        sublabel: "Awaiting source release",
        icon: Clock,
        color: requested > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("requested"),
      },
      {
        id: "dispatched",
        label: "In Transit",
        value: dispatched,
        sublabel: "En route to destination",
        icon: Truck,
        color: dispatched > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("dispatched"),
      },
      {
        id: "received",
        label: "Fully Received",
        value: received,
        sublabel: "Stock reconciled",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("received"),
      },
    ];
  }, [transfers]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!transfers) return [];
    const itemsList: AttentionItem[] = [];

    const requested = transfers.filter((t) => t.status === "requested");
    if (requested.length > 0) {
      itemsList.push({
        id: "pending-dispatch",
        title: `${requested.length} transfer${requested.length > 1 ? "s" : ""} awaiting dispatch`,
        description: "Items are staged but not yet released from the source warehouse depot.",
        severity: "warning",
        count: requested.length,
        actionLabel: "View Pending",
        onAction: () => setActiveTab("requested"),
      });
    }

    const inTransit = transfers.filter((t) => t.status === "dispatched");
    if (inTransit.length > 0) {
      itemsList.push({
        id: "in-transit",
        title: `${inTransit.length} transfer${inTransit.length > 1 ? "s" : ""} currently in transit`,
        description: "Goods have left the origin godown. Awaiting physical gate check & GRN at destination.",
        severity: "info",
        count: inTransit.length,
        actionLabel: "View In-Transit",
        onAction: () => setActiveTab("dispatched"),
      });
    }

    return itemsList;
  }, [transfers]);

  // Filtered List
  const filteredTransfers = useMemo(() => {
    if (!transfers) return [];
    return transfers.filter((t) => {
      // Tab filter
      if (activeTab !== "all" && t.status !== activeTab) {
        return false;
      }
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const origin = warehouseName(t.from_warehouse_id).toLowerCase();
        const dest = warehouseName(t.to_warehouse_id).toLowerCase();
        const num = (t.number || "").toLowerCase();
        if (!origin.includes(query) && !dest.includes(query) && !num.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [transfers, activeTab, search, warehouses]);

  // Tab definitions
  const tabs = useMemo(() => {
    if (!transfers) return [];
    return [
      { id: "all", label: "All Transfers", count: transfers.length },
      {
        id: "requested",
        label: "Pending Dispatch",
        count: transfers.filter((t) => t.status === "requested").length,
      },
      {
        id: "dispatched",
        label: "In Transit",
        count: transfers.filter((t) => t.status === "dispatched").length,
      },
      {
        id: "received",
        label: "Received",
        count: transfers.filter((t) => t.status === "received").length,
      },
    ];
  }, [transfers]);

  // Bulk actions
  const handleBulkExport = () => {
    const selected = transfers?.filter((t) => selectedIds.includes(t.id)) ?? [];
    exportCsv(selected.length > 0 ? selected : (transfers ?? []));
  };

  const exportCsv = (dataList: Transfer[]) => {
    const headers = ["Transfer Number", "Origin Warehouse", "Destination Warehouse", "Status", "Items Count"];
    const rows = dataList.map((t) => [
      t.number,
      warehouseName(t.from_warehouse_id),
      warehouseName(t.to_warehouse_id),
      t.status,
      t.items?.length ?? 0,
    ]);
    downloadCsv("warehouse-transfers.csv", [headers, ...rows]);
    toast.success(`Exported ${dataList.length} transfer records`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTransfers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransfers.map((t) => t.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Inter-Warehouse Transfers"
        description="Rebalance stock inventory, authorize godown transfers, dispatch goods, and acknowledge gate receipt."
        primaryAction={{
          label: showForm ? "Close Form" : "New Transfer",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => exportCsv(transfers ?? []),
          },
          {
            label: isFetching ? "Refreshing..." : "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* 2. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Warehouse Logistics Exceptions"
        items={attentionItems}
        allClearMessage="All transfers are dispatched and reconciled. No pending logistics backlog."
      />

      {/* 4. New Transfer Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Initiate Stock Transfer</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Transfer materials between godowns with full audit trail and stock movement reconciliation.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From Origin Warehouse *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  <option value="">Select origin warehouse...</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>To Destination Warehouse *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  <option value="">Select destination warehouse...</option>
                  {warehouses
                    ?.filter((w) => w.id !== fromId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Select Item / Material *</Label>
                <ItemSelect
                  className="h-10"
                  items={items}
                  categories={categories}
                  value={itemId}
                  onChange={setItemId}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Transfer Quantity *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
            </div>

            {createTransfer.isError && <ErrorState error={createTransfer.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createTransfer.mutate()}
                disabled={!fromId || !toId || !itemId || !qty || createTransfer.isPending}
              >
                {createTransfer.isPending ? "Creating Transfer..." : "Authorize Transfer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by transfer # or warehouse..."
      />

      {/* 6. Main Transfer List Workspace */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && filteredTransfers.length === 0 && (
        <SmartEmptyState
          mode={search || activeTab !== "all" ? "filtered" : "first-time"}
          title={search || activeTab !== "all" ? "No matching transfers" : "No stock transfers recorded"}
          description={
            search || activeTab !== "all"
              ? "Try adjusting your search criteria or switching status tabs."
              : "Rebalance stock between warehouses or branches to prevent stockouts."
          }
          actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Create Transfer"}
          onAction={() => {
            if (search || activeTab !== "all") {
              setSearch("");
              setActiveTab("all");
            } else {
              setShowForm(true);
            }
          }}
        />
      )}

      {!isLoading && !error && filteredTransfers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={selectedIds.length === filteredTransfers.length}
                onChange={toggleSelectAll}
              />
              <span>
                Showing {filteredTransfers.length} transfer{filteredTransfers.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {filteredTransfers.map((t) => {
              const isSelected = selectedIds.includes(t.id);
              const itemsCount = t.items?.length ?? 1;

              return (
                <div
                  key={t.id}
                  className={`flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between ${
                    isSelected ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={isSelected}
                      onChange={() => toggleSelect(t.id)}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{t.number}</span>
                        <StatusBadge status={t.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {warehouseName(t.from_warehouse_id)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {warehouseName(t.to_warehouse_id)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {itemsCount} {itemsCount === 1 ? "item line" : "item lines"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {t.status === "requested" && (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => dispatch.mutate(t.id)}
                        disabled={dispatch.isPending}
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Dispatch
                      </Button>
                    )}

                    {t.status === "dispatched" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5"
                        onClick={() => receive.mutate(t.id)}
                        disabled={receive.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Acknowledge Receipt
                      </Button>
                    )}

                    <RowActions
                      onQuickPeek={() => setSelectedTransfer(t)}
                      actions={[
                        {
                          label: "View Manifest Lines",
                          icon: Package,
                          onClick: () => setSelectedTransfer(t),
                        },
                        ...(t.status === "requested"
                          ? [
                              {
                                label: "Mark as Dispatched",
                                icon: Truck,
                                onClick: () => dispatch.mutate(t.id),
                              },
                            ]
                          : []),
                        ...(t.status === "dispatched"
                          ? [
                              {
                                label: "Confirm Goods Receipt",
                                icon: CheckCircle2,
                                onClick: () => receive.mutate(t.id),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: "Export Selected",
            icon: Download,
            onClick: handleBulkExport,
          },
        ]}
      />

      {/* 8. Transfer Detail 360 Drawer */}
      <DetailDrawer
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title={selectedTransfer?.number ?? "Transfer Details"}
        subtitle="Inter-Warehouse Transfer Manifest & Audit Trail"
        badge={selectedTransfer?.status ? <StatusBadge status={selectedTransfer.status} /> : undefined}
        metrics={[
          {
            label: "Origin",
            value: selectedTransfer ? warehouseName(selectedTransfer.from_warehouse_id) : "—",
          },
          {
            label: "Destination",
            value: selectedTransfer ? warehouseName(selectedTransfer.to_warehouse_id) : "—",
          },
          {
            label: "Total Lines",
            value: selectedTransfer?.items?.length ?? 1,
          },
          {
            label: "Status",
            value: selectedTransfer?.status?.toUpperCase() ?? "—",
          },
        ]}
        actions={
          selectedTransfer?.status === "requested" ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                dispatch.mutate(selectedTransfer.id);
              }}
              disabled={dispatch.isPending}
            >
              <Truck className="h-4 w-4" />
              Dispatch Goods Now
            </Button>
          ) : selectedTransfer?.status === "dispatched" ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                receive.mutate(selectedTransfer.id);
              }}
              disabled={receive.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Goods Receipt
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* Transfer Route Card */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transfer Route
            </h4>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">From Origin</span>
                <p className="font-semibold text-foreground">
                  {selectedTransfer ? warehouseName(selectedTransfer.from_warehouse_id) : "—"}
                </p>
              </div>
              <div className="flex flex-col items-center px-4">
                <Truck className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-right">
                <span className="text-xs text-muted-foreground">To Destination</span>
                <p className="font-semibold text-foreground">
                  {selectedTransfer ? warehouseName(selectedTransfer.to_warehouse_id) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Transfer Lines / Items */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transfer Lines & Quantities
            </h4>
            {selectedTransfer?.items && selectedTransfer.items.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {selectedTransfer.items.map((line, idx) => (
                  <div key={line.id || idx} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {itemName(line.item_id)}
                      </span>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                      Qty: {line.qty}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Standard single-line stock transfer. Quantity recorded in stock movement journal.
              </p>
            )}
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
