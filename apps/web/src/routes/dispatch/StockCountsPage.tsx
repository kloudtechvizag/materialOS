import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Plus,
  RefreshCw,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
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
import { groupItemsByCategory } from "@/lib/items";

interface Warehouse {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  category_id: string | null;
}

interface StockCount {
  id: string;
  warehouse_id: string;
  count_date: string;
  status: string;
  items: { id: string; item_id?: string; system_qty?: string; counted_qty?: string; variance?: string }[];
}

export function StockCountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null);

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

  const itemGroups = useMemo(() => {
    return groupItemsByCategory(items, categories);
  }, [items, categories]);

  const {
    data: counts,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["stock-counts"],
    queryFn: () => apiFetch<StockCount[]>("/stock-counts"),
  });

  const createCount = useMutation({
    mutationFn: () =>
      apiFetch<StockCount>("/stock-counts", {
        method: "POST",
        body: { warehouse_id: warehouseId, item_ids: Array.from(selectedItems) },
      }),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Stock count session initialized");
      navigate(`/stock-counts/${count.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to start stock count");
    },
  });

  function warehouseName(id: string) {
    return warehouses?.find((w) => w.id === id)?.name ?? id;
  }

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(groupItemIds: string[]) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      const allSelected = groupItemIds.every((id) => next.has(id));
      if (allSelected) {
        groupItemIds.forEach((id) => next.delete(id));
      } else {
        groupItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!counts) return [];
    const total = counts.length;
    const drafts = counts.filter((c) => c.status === "draft").length;
    const submitted = counts.filter((c) => c.status === "submitted").length;
    const approved = counts.filter((c) => c.status === "approved").length;

    return [
      {
        id: "total",
        label: "Total Audits",
        value: total,
        sublabel: "Physical verification runs",
        icon: ClipboardList,
        color: "primary",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "draft",
        label: "Counting in Progress",
        value: drafts,
        sublabel: "Active floor blind counts",
        icon: Clock,
        color: drafts > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("draft"),
      },
      {
        id: "submitted",
        label: "Awaiting Variance Approval",
        value: submitted,
        sublabel: "Ready for ledger adjustment",
        icon: AlertTriangle,
        color: submitted > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("submitted"),
      },
      {
        id: "approved",
        label: "Approved & Reconciled",
        value: approved,
        sublabel: "Book adjustments posted",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("approved"),
      },
    ];
  }, [counts]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!counts) return [];
    const itemsList: AttentionItem[] = [];

    const pendingApproval = counts.filter((c) => c.status === "submitted");
    if (pendingApproval.length > 0) {
      itemsList.push({
        id: "pending-approval",
        title: `${pendingApproval.length} stock count${pendingApproval.length > 1 ? "s" : ""} awaiting variance review & approval`,
        description: "Floor tallies have been submitted. Review discrepancies before posting inventory adjustments.",
        severity: "warning",
        count: pendingApproval.length,
        actionLabel: "Review Submissions",
        onAction: () => setActiveTab("submitted"),
      });
    }

    const activeDrafts = counts.filter((c) => c.status === "draft");
    if (activeDrafts.length > 0) {
      itemsList.push({
        id: "active-drafts",
        title: `${activeDrafts.length} audit session${activeDrafts.length > 1 ? "s" : ""} currently in progress`,
        description: "Warehouse floor staff are conducting physical counts. Awaiting entry submission.",
        severity: "info",
        count: activeDrafts.length,
        actionLabel: "View In-Progress",
        onAction: () => setActiveTab("draft"),
      });
    }

    return itemsList;
  }, [counts]);

  // Filtered counts
  const filteredCounts = useMemo(() => {
    if (!counts) return [];
    return counts.filter((c) => {
      if (activeTab !== "all" && c.status !== activeTab) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const wName = warehouseName(c.warehouse_id).toLowerCase();
        const date = (c.count_date || "").toLowerCase();
        if (!wName.includes(query) && !date.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [counts, activeTab, search, warehouses]);

  // Tabs
  const tabs = useMemo(() => {
    if (!counts) return [];
    return [
      { id: "all", label: "All Audits", count: counts.length },
      {
        id: "draft",
        label: "In Progress",
        count: counts.filter((c) => c.status === "draft").length,
      },
      {
        id: "submitted",
        label: "Awaiting Signoff",
        count: counts.filter((c) => c.status === "submitted").length,
      },
      {
        id: "approved",
        label: "Reconciled",
        count: counts.filter((c) => c.status === "approved").length,
      },
    ];
  }, [counts]);

  const exportCsv = () => {
    if (!counts) return;
    const headers = ["Audit ID", "Warehouse", "Count Date", "Status", "Items Counted"];
    const rows = counts.map((c) => [
      c.id,
      warehouseName(c.warehouse_id),
      c.count_date,
      c.status,
      c.items.length,
    ]);
    downloadCsv("physical-stock-audits.csv", [headers, ...rows]);
    toast.success(`Exported ${counts.length} stock audit sessions`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Physical Stock Audits & Blind Counts"
        description="Verify floor inventory against book stock, identify shrinkage or discrepancies, and post approved variance adjustments."
        primaryAction={{
          label: showForm ? "Close Form" : "Start Blind Count",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: exportCsv,
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
        title="Inventory Reconciliation Queue"
        items={attentionItems}
        allClearMessage="No pending stock count approvals. Physical books are completely reconciled."
      />

      {/* 4. Start Count Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold text-foreground">Initiate Blind Count Session</h3>
                <p className="text-xs text-muted-foreground">
                  Blind counts keep system stock quantities hidden from counters to prevent confirmation bias.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Target Warehouse Godown *</Label>
              <select
                className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select target warehouse...</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Items to Include in Floor Audit ({selectedItems.size} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (items) {
                        setSelectedItems(new Set(items.map((i) => i.id)));
                      }
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
                {itemGroups.map((group) => {
                  const groupItemIds = group.items.map((i) => i.id);
                  const allInGroup = groupItemIds.every((id) => selectedItems.has(id));

                  return (
                    <div key={group.id} className="rounded-md border border-border/50 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => selectAllInGroup(groupItemIds)}
                        >
                          {allInGroup ? "Deselect group" : "Select group"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-border"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                            />
                            <span className="truncate text-foreground">{item.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {createCount.isError && <ErrorState error={createCount.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createCount.mutate()}
                disabled={!warehouseId || selectedItems.size === 0 || createCount.isPending}
              >
                {createCount.isPending
                  ? "Starting Session..."
                  : `Start Floor Count (${selectedItems.size} items)`}
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
        searchPlaceholder="Filter by warehouse or date..."
      />

      {/* 6. List of Counts */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && filteredCounts.length === 0 && (
        <SmartEmptyState
          mode={search || activeTab !== "all" ? "filtered" : "first-time"}
          title={search || activeTab !== "all" ? "No matching stock counts" : "No stock counts yet"}
          description={
            search || activeTab !== "all"
              ? "Try resetting your search or switching status tabs."
              : "Start a blind physical inventory count for a godown to verify physical stock against book records."
          }
          actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Start First Count"}
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

      {!isLoading && !error && filteredCounts.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {filteredCounts.map((c) => {
            const countItemsTotal = c.items?.length ?? 0;
            const wName = warehouseName(c.warehouse_id);

            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Stock Count — {c.count_date}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {wName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {countItemsTotal} {countItemsTotal === 1 ? "item audited" : "items audited"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {c.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => navigate(`/stock-counts/${c.id}`)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Resume Tally
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}

                  {c.status === "submitted" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                      onClick={() => navigate(`/stock-counts/${c.id}`)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Review & Approve
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}

                  {c.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => navigate(`/stock-counts/${c.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Reconciled
                    </Button>
                  )}

                  <RowActions
                    onQuickPeek={() => setSelectedCount(c)}
                    actions={[
                      {
                        label: "Open Full Worksheet",
                        icon: ClipboardList,
                        onClick: () => navigate(`/stock-counts/${c.id}`),
                      },
                      {
                        label: "Quick Peek Summary",
                        icon: Eye,
                        onClick: () => setSelectedCount(c),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Stock Count Quick Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedCount}
        onClose={() => setSelectedCount(null)}
        title={selectedCount ? `Stock Count — ${selectedCount.count_date}` : "Audit Details"}
        subtitle="Physical Stock Audit Session Snapshot"
        badge={selectedCount?.status ? <StatusBadge status={selectedCount.status} /> : undefined}
        metrics={[
          {
            label: "Warehouse",
            value: selectedCount ? warehouseName(selectedCount.warehouse_id) : "—",
          },
          {
            label: "Count Date",
            value: selectedCount?.count_date ?? "—",
          },
          {
            label: "Items Tagged",
            value: selectedCount?.items?.length ?? 0,
          },
          {
            label: "Status",
            value: selectedCount?.status?.toUpperCase() ?? "—",
          },
        ]}
        actions={
          selectedCount ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                navigate(`/stock-counts/${selectedCount.id}`);
              }}
            >
              <ClipboardCheck className="h-4 w-4" />
              Open Audit Worksheet
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Audit Workflow Status
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCount?.status === "draft" &&
                "Count is actively in-progress on the godown floor. Quantities can be entered by counters."}
              {selectedCount?.status === "submitted" &&
                "Count has been submitted. Discrepancies between book stock and physical count are calculated and awaiting manager approval."}
              {selectedCount?.status === "approved" &&
                "Count has been approved. System inventory ledgers were adjusted automatically to match physical count."}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items Summary
            </h4>
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
              {selectedCount?.items?.length ?? 0} item lines are enrolled in this audit session. Open
              the full worksheet to inspect book stock, physical count, and computed variances.
            </div>
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
