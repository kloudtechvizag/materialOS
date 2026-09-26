import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  Truck,
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

interface SalesOrder {
  id: string;
  number: string;
  status: string;
  total: string;
  order_date: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  credit_hold: "destructive",
  reserved: "secondary",
  dispatched: "secondary",
  invoiced: "success",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  credit_hold: "Credit hold",
  reserved: "Awaiting dispatch",
  dispatched: "Dispatched",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export function SalesOrdersPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "all";

  const [activeView, setActiveView] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["sales-orders"],
    queryFn: () => apiFetch<SalesOrder[]>("/sales-orders"),
  });

  // Business calculations
  const {
    awaitingDispatch,
    creditHoldCount,
    invoicedCount,
    draftCount,
    totalOrderValue,
  } = useMemo(() => {
    let reserved = 0;
    let creditHold = 0;
    let invoiced = 0;
    let draft = 0;
    let totalVal = 0;

    for (const o of orders) {
      totalVal += Number(o.total) || 0;
      if (o.status === "reserved") reserved++;
      if (o.status === "credit_hold") creditHold++;
      if (o.status === "invoiced") invoiced++;
      if (o.status === "draft") draft++;
    }

    return {
      awaitingDispatch: reserved,
      creditHoldCount: creditHold,
      invoicedCount: invoiced,
      draftCount: draft,
      totalOrderValue: totalVal,
    };
  }, [orders]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Orders",
        value: orders.length,
        sublabel: "Fulfillment pipeline",
        icon: ClipboardList,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "awaiting-dispatch",
        label: "Awaiting Dispatch",
        value: awaitingDispatch,
        sublabel: "Stock reserved in godown",
        icon: Truck,
        color: "sky",
        active: activeView === "reserved",
        onClick: () => setActiveView("reserved"),
      },
      {
        id: "credit-hold",
        label: "Credit Hold",
        value: creditHoldCount,
        sublabel: "Exceeds approved limit",
        icon: ShieldAlert,
        color: creditHoldCount > 0 ? "rose" : "slate",
        active: activeView === "credit_hold",
        onClick: () => setActiveView("credit_hold"),
      },
      {
        id: "invoiced",
        label: "Invoiced Orders",
        value: invoicedCount,
        sublabel: "Dispatched and billed",
        icon: PackageCheck,
        color: "emerald",
        active: activeView === "invoiced",
        onClick: () => setActiveView("invoiced"),
      },
      {
        id: "total-value",
        label: "Pipeline Value",
        value: formatINRCompact(totalOrderValue),
        sublabel: "Gross order throughput",
        icon: FileText,
        color: "indigo",
      },
    ],
    [
      orders.length,
      awaitingDispatch,
      creditHoldCount,
      invoicedCount,
      totalOrderValue,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (creditHoldCount > 0) {
      items.push({
        id: "att-credit-hold",
        title: `${creditHoldCount} order${creditHoldCount > 1 ? "s" : ""} on credit hold`,
        severity: "critical",
        count: creditHoldCount,
        description: "Customer credit limit exceeded. Requires approval or advance payment before dispatch.",
        actionLabel: "Review credit holds",
        onClick: () => setActiveView("credit_hold"),
      });
    }

    if (awaitingDispatch > 0) {
      items.push({
        id: "att-dispatch",
        title: `${awaitingDispatch} order${awaitingDispatch > 1 ? "s" : ""} ready for dispatch`,
        severity: "warning",
        count: awaitingDispatch,
        description: "Stock is reserved and waiting for delivery challan and vehicle allocation.",
        actionLabel: "View pending dispatches",
        onClick: () => setActiveView("reserved"),
      });
    }

    return items;
  }, [creditHoldCount, awaitingDispatch]);

  // Views & Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Saved views
      if (activeView !== "all" && o.status !== activeView) {
        return false;
      }

      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const num = o.number.toLowerCase();
        const date = (o.order_date ?? "").toLowerCase();
        const status = (STATUS_LABEL[o.status] ?? o.status).toLowerCase();
        if (!num.includes(q) && !date.includes(q) && !status.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeView, search]);

  // Selections
  function toggleSelectAll() {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredOrders.map((o) => [
      o.number,
      o.order_date,
      STATUS_LABEL[o.status] ?? o.status,
      o.total,
    ]);
    downloadCsv("materialos_sales_orders.csv", [
      ["Order Number", "Order Date", "Status", "Total Amount (₹)"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredOrders.length} sales orders`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Sales Orders"
        subtitle="Order fulfillment lifecycle: stock reservations, credit control checks, dispatching, and invoicing."
        badge={{ label: `${orders.length} Orders`, variant: "outline" }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: orders.length === 0,
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
          { id: "all", label: "All Orders", count: orders.length },
          { id: "reserved", label: "Awaiting Dispatch", count: awaitingDispatch },
          { id: "credit_hold", label: "Credit Hold", count: creditHoldCount },
          { id: "invoiced", label: "Invoiced", count: invoicedCount },
          { id: "draft", label: "Draft", count: draftCount },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search order number or date..."
        hasActiveFilters={Boolean(search || activeView !== "all")}
        onClearFilters={() => {
          setSearch("");
          setActiveView("all");
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
      {!isLoading && orders.length === 0 && (
        <SmartEmptyState
          type="first-time"
          icon={ClipboardList}
          title="No sales orders yet"
          description="Sales orders are created by approving and converting customer quotations."
          tip="Go to Quotations to generate sales orders with automatic stock reservations."
          primaryAction={{
            label: "View Quotations",
            href: "/quotations",
          }}
        />
      )}

      {!isLoading && orders.length > 0 && filteredOrders.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No orders match your filter"
          description={`No sales orders found under the "${activeView}" view.`}
          primaryAction={{
            label: "Reset Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredOrders.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Order Number</th>
                  <th className="p-3">Order Date</th>
                  <th className="p-3">Fulfillment Status</th>
                  <th className="p-3 text-right">Order Total</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOrders.map((o) => {
                  const isSelected = selectedIds.includes(o.id);
                  const isCreditHold = o.status === "credit_hold";

                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5",
                        isCreditHold && "bg-rose-50/20 dark:bg-rose-950/10"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(o.id)}
                          aria-label={`Select order ${o.number}`}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewOrder(o)}
                            className="font-semibold text-primary hover:underline text-left"
                          >
                            {o.number}
                          </button>
                        </div>
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        {o.order_date ? new Date(o.order_date).toLocaleDateString("en-IN") : "—"}
                      </td>

                      <td className="p-3">
                        <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="text-xs">
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </td>

                      <td className="p-3 text-right font-semibold font-mono text-xs">
                        {formatINR(o.total)}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewOrder(o),
                            },
                          ]}
                          actions={[
                            {
                              id: "open",
                              label: "Open Order Details",
                              icon: ArrowRight,
                              onClick: () => {
                                window.location.href = `/sales-orders/${o.id}`;
                              },
                            },
                            {
                              id: "copy",
                              label: "Copy Order Number",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(o.number);
                                toast.success(`Copied ${o.number}`);
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
        totalCount={filteredOrders.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
              downloadCsv("materialos_selected_orders.csv", [
                ["Order Number", "Date", "Status", "Total"],
                ...selectedOrders.map((o) => [
                  o.number,
                  o.order_date,
                  STATUS_LABEL[o.status] ?? o.status,
                  o.total,
                ]),
              ]);
              toast.success(`Exported ${selectedOrders.length} sales orders`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewOrder && (
        <DetailDrawer
          open={!!previewOrder}
          onOpenChange={(open) => !open && setPreviewOrder(null)}
          title={`Order ${previewOrder.number}`}
          subtitle={`Placed on ${previewOrder.order_date}`}
          statusBadge={{
            label: STATUS_LABEL[previewOrder.status] ?? previewOrder.status,
            variant: STATUS_VARIANT[previewOrder.status] ?? "outline",
          }}
          fullRecordHref={`/sales-orders/${previewOrder.id}`}
          fullRecordLabel="Open Full Order Workspace"
          primaryAction={{
            label: "Open Order",
            href: `/sales-orders/${previewOrder.id}`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Order Value</p>
                <p className="text-base font-bold font-mono mt-0.5 text-foreground">
                  {formatINR(previewOrder.total)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Current Status</p>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  {STATUS_LABEL[previewOrder.status] ?? previewOrder.status}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Fulfillment Actions</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/sales-orders/${previewOrder.id}`}>
                    <ArrowRight className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>View Line Items & Allocate Dispatch</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/dispatch-board`}>
                    <Truck className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Open Dispatch Board</span>
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
