import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Download,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { QuickAddContactModal } from "@/components/entities/QuickAddContactModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
import { ItemSelect } from "@/components/items/ItemSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
import { formatINR, formatINRCompact } from "@/lib/format";
import type { CategoryLite } from "@/lib/items";

interface Supplier {
  id: string;
  name: string;
}
interface Warehouse {
  id: string;
  name: string;
}
interface Item {
  id: string;
  name: string;
  base_uom: string;
  standard_cost: string;
  category_id: string | null;
}
interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  po_date: string;
}
interface Line {
  item_id: string;
  qty: string;
  rate: string;
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", qty: "", rate: "" }]);
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);

  // Filters & selection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedOrder, setInspectedOrder] = useState<PurchaseOrder | null>(null);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/suppliers"),
  });
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
    data: orders,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => apiFetch<PurchaseOrder[]>("/purchase-orders"),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      apiFetch<PurchaseOrder>("/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          lines: lines
            .filter((l) => l.item_id && l.qty && l.rate)
            .map((l) => ({
              item_id: l.item_id,
              qty: Number(l.qty),
              rate: Number(l.rate),
            })),
        },
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success(`Purchase order ${order.number} created successfully.`);
      navigate(`/purchase-orders/${order.id}`);
    },
  });

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const validLines = lines.filter((l) => l.item_id && l.qty && l.rate);
  const calculatedSubtotal = validLines.reduce((acc, l) => acc + Number(l.qty) * Number(l.rate), 0);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      // Tab filter
      if (activeTab === "draft" && o.status !== "draft") return false;
      if (activeTab === "open" && (o.status === "received" || o.status === "cancelled")) return false;
      if (activeTab === "partially_received" && o.status !== "partially_received") return false;
      if (activeTab === "received" && o.status !== "received") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = o.number.toLowerCase().includes(q);
        const matchDate = o.po_date?.toLowerCase().includes(q);
        const matchStatus = o.status.toLowerCase().includes(q);
        if (!matchNumber && !matchDate && !matchStatus) return false;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!orders) return [];
    const totalCount = orders.length;
    const totalVal = orders.reduce((acc, o) => acc + Number(o.subtotal || 0), 0);
    const openOrders = orders.filter((o) => o.status !== "received" && o.status !== "cancelled");
    const openVal = openOrders.reduce((acc, o) => acc + Number(o.subtotal || 0), 0);
    const draftCount = orders.filter((o) => o.status === "draft").length;
    const receivedCount = orders.filter((o) => o.status === "received").length;

    return [
      {
        id: "total",
        label: "Total Procurement",
        value: totalCount,
        subvalue: formatINRCompact(totalVal),
        icon: ShoppingCart,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "open",
        label: "Active / In Transit",
        value: openOrders.length,
        subvalue: formatINRCompact(openVal),
        icon: Truck,
        color: "sky",
        onClick: () => setActiveTab("open"),
      },
      {
        id: "draft",
        label: "Drafts to Confirm",
        value: draftCount,
        subvalue: draftCount > 0 ? "Awaiting release" : "None pending",
        icon: Clock,
        color: draftCount > 0 ? "amber" : "slate",
        onClick: () => setActiveTab("draft"),
      },
      {
        id: "received",
        label: "Completed GRN",
        value: receivedCount,
        subvalue: "Goods in warehouse",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("received"),
      },
    ];
  }, [orders]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!orders) return [];
    const itemsList: AttentionItem[] = [];

    const drafts = orders.filter((o) => o.status === "draft");
    if (drafts.length > 0) {
      itemsList.push({
        id: "drafts",
        title: "Draft Purchase Orders",
        count: drafts.length,
        description: "Orders created but not yet sent or approved for vendor fulfillment.",
        severity: "warning",
        actionLabel: "View Drafts",
        onAction: () => setActiveTab("draft"),
      });
    }

    const partials = orders.filter((o) => o.status === "partially_received");
    if (partials.length > 0) {
      itemsList.push({
        id: "partials",
        title: "Partially Received Shipments",
        count: partials.length,
        description: "Vendors have delivered partial quantities; pending backorders require follow-up.",
        severity: "critical",
        actionLabel: "Inspect Backorders",
        onAction: () => setActiveTab("partially_received"),
      });
    }

    return itemsList;
  }, [orders]);

  // Saved view tabs
  const viewTabs = useMemo(() => {
    if (!orders) return [];
    const openCount = orders.filter((o) => o.status !== "received" && o.status !== "cancelled").length;
    const draftCount = orders.filter((o) => o.status === "draft").length;
    const partialCount = orders.filter((o) => o.status === "partially_received").length;
    const receivedCount = orders.filter((o) => o.status === "received").length;

    return [
      { id: "all", label: "All Orders", count: orders.length },
      { id: "open", label: "Open & Pending", count: openCount },
      { id: "draft", label: "Draft", count: draftCount },
      { id: "partially_received", label: "Partial GRN", count: partialCount },
      { id: "received", label: "Received", count: receivedCount },
    ];
  }, [orders]);

  // Bulk actions
  const allSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleExportCsv = (rowsToExport = filteredOrders) => {
    downloadCsv("purchase-orders", [
      ["PO Number", "Date", "Status", "Total Amount"],
      ...rowsToExport.map((o) => [o.number, o.po_date || "", o.status, o.subtotal]),
    ]);
    toast.success(`Exported ${rowsToExport.length} purchase orders to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Purchase Orders"
        subtitle="Procure goods from suppliers: Order → Goods Receipt (GRN) → Landed Cost → Vendor Bill → Payment."
        badge={orders ? `${orders.length} total` : undefined}
        primaryAction={{
          label: showForm ? "Cancel" : "New Purchase Order",
          icon: Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => handleExportCsv(),
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Metrics */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Procurement Exceptions & Follow-ups"
        items={attentionItems}
        allClearMessage="All purchase orders are proceeding on schedule. No overdue shipments or stalled drafts."
      />

      {/* 4. PO Creation Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-base font-semibold">New Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Supplier *</label>
                <SearchableSelect
                  options={suppliers?.map((s) => ({ id: s.id, label: s.name }))}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Select supplier..."
                  searchPlaceholder="Search suppliers..."
                  emptyText="No suppliers match."
                  quickAddLabel="Quick Add Supplier"
                  onQuickAdd={() => setQuickAddSupplierOpen(true)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Receive into Warehouse *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  <option value="">Select receiving warehouse...</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Line Items</label>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <ItemSelect
                    className="col-span-12 sm:col-span-6"
                    items={items}
                    categories={categories}
                    value={line.item_id}
                    onChange={(itemId) => {
                      const selected = items?.find((it) => it.id === itemId);
                      updateLine(i, { item_id: itemId, rate: line.rate || selected?.standard_cost || "" });
                    }}
                  />
                  <Input
                    className="col-span-5 sm:col-span-2"
                    type="number"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                  />
                  <Input
                    className="col-span-5 sm:col-span-3"
                    type="number"
                    placeholder="Unit Rate (₹)"
                    value={line.rate}
                    onChange={(e) => updateLine(i, { rate: e.target.value })}
                  />
                  <button
                    className="col-span-2 sm:col-span-1 flex justify-center text-muted-foreground hover:text-destructive"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { item_id: "", qty: "", rate: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Line Item
              </Button>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Estimated Total: </span>
                <span className="text-base font-bold text-foreground">{formatINR(calculatedSubtotal)}</span>
              </div>
            </div>

            {createOrder.isError && <ErrorState error={createOrder.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createOrder.mutate()}
                disabled={!supplierId || !warehouseId || validLines.length === 0 || createOrder.isPending}
              >
                {createOrder.isPending ? "Creating Order..." : "Confirm & Create Purchase Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search PO #, status, date..."
      />

      {/* Quick Add Supplier Modal */}
      <QuickAddContactModal<Supplier>
        open={quickAddSupplierOpen}
        onOpenChange={setQuickAddSupplierOpen}
        title="Supplier"
        endpoint="/suppliers"
        queryKey="suppliers"
        onCreated={(supplier) => setSupplierId(supplier.id)}
      />

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* 6. Smart Empty States */}
      {orders && orders.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={ShoppingCart}
          title="No purchase orders created yet"
          description="Create your first purchase order to order goods, track deliveries, and manage vendor costs."
          tip="You can track incoming goods, link GRNs, and record landed transportation costs directly from the order."
          primaryAction={{
            label: "Create First Purchase Order",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {orders && orders.length > 0 && filteredOrders.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No purchase orders match your filters"
          description={`No orders match status "${activeTab}" with search "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filters",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 7. Action-First Data Grid */}
      {filteredOrders.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Order Number</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total Amount</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.map((o) => (
                <tr
                  key={o.id}
                  className="group transition-colors hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.includes(o.id)}
                      onCheckedChange={() => toggleSelectOne(o.id)}
                      aria-label={`Select ${o.number}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/purchase-orders/${o.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.po_date || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatINR(o.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      onView={() => setInspectedOrder(o)}
                      onCopy={() => {
                        navigator.clipboard.writeText(o.number);
                        toast.success(`Copied ${o.number}`);
                      }}
                      viewLabel="Inspect Order"
                      detailHref={`/purchase-orders/${o.id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedRows = filteredOrders.filter((o) => selectedIds.includes(o.id));
              handleExportCsv(selectedRows);
            },
          },
        ]}
      />

      {/* 9. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedOrder)}
        onOpenChange={(open) => !open && setInspectedOrder(null)}
        title={inspectedOrder ? `Purchase Order ${inspectedOrder.number}` : ""}
        subtitle={inspectedOrder?.po_date ? `Issued on ${inspectedOrder.po_date}` : undefined}
        badge={inspectedOrder ? <StatusBadge status={inspectedOrder.status} /> : undefined}
        fullRecordHref={inspectedOrder ? `/purchase-orders/${inspectedOrder.id}` : undefined}
        metrics={
          inspectedOrder
            ? [
                { label: "Total Amount", value: formatINR(inspectedOrder.subtotal) },
                { label: "Status", value: inspectedOrder.status.toUpperCase() },
              ]
            : []
        }
        sections={
          inspectedOrder
            ? [
                {
                  title: "Workflow Progress",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>1. Purchase Order Created</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>2. Goods Receipt Note (GRN)</span>
                        {inspectedOrder.status === "received" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>3. Landed Cost Allocation</span>
                        <span className="text-muted-foreground">—</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>4. Vendor Bill &amp; Payment</span>
                        <span className="text-muted-foreground">—</span>
                      </div>
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
