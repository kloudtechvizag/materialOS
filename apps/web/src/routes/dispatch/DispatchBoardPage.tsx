import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Send,
  Truck,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  DetailDrawer,
  MetricStrip,
  NextBestAction,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { formatINR, formatINRCompact } from "@/lib/format";

interface OrderCard {
  id: string;
  number: string;
  total: string;
}

interface ChallanCard {
  id: string;
  number: string;
  sales_order_id: string;
}

interface Board {
  pending_orders: OrderCard[];
  ready_to_dispatch: OrderCard[];
  dispatched: ChallanCard[];
  delivered: ChallanCard[];
}

export function DispatchBoardPage() {
  const [inspectedOrder, setInspectedOrder] = useState<OrderCard | null>(null);
  const [inspectedChallan, setInspectedChallan] = useState<ChallanCard | null>(null);

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["dispatch-board"],
    queryFn: () => apiFetch<Board>("/dispatch-board"),
  });

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!data) return [];
    const readyCount = data.ready_to_dispatch.length;
    const readyVal = data.ready_to_dispatch.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const inTransitCount = data.dispatched.length;
    const deliveredCount = data.delivered.length;
    const pendingCount = data.pending_orders.length;
    const pendingVal = data.pending_orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    return [
      {
        id: "ready",
        label: "Ready for Dispatch",
        value: readyCount,
        subvalue: formatINRCompact(readyVal),
        icon: Package,
        color: readyCount > 0 ? "emerald" : "slate",
      },
      {
        id: "transit",
        label: "In Transit / Dispatched",
        value: inTransitCount,
        subvalue: "On the road",
        icon: Truck,
        color: "sky",
      },
      {
        id: "delivered",
        label: "Delivered & Closed",
        value: deliveredCount,
        subvalue: "Proof of Delivery complete",
        icon: CheckCircle2,
        color: "indigo",
      },
      {
        id: "pending",
        label: "Awaiting Allocation",
        value: pendingCount,
        subvalue: formatINRCompact(pendingVal),
        icon: Clock,
        color: "amber",
      },
    ];
  }, [data]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!data) return [];
    const itemsList: AttentionItem[] = [];

    if (data.ready_to_dispatch.length > 0) {
      itemsList.push({
        id: "ready-dispatch",
        title: `${data.ready_to_dispatch.length} Order${data.ready_to_dispatch.length > 1 ? "s" : ""} Staged & Ready for Dispatch`,
        count: data.ready_to_dispatch.length,
        description: "Items are reserved in warehouse and awaiting vehicle assignment / gate pass creation.",
        severity: "critical",
        actionLabel: "View Ready Queue",
      });
    }

    if (data.dispatched.length > 0) {
      itemsList.push({
        id: "in-transit",
        title: `${data.dispatched.length} Delivery Challan${data.dispatched.length > 1 ? "s" : ""} in Transit`,
        count: data.dispatched.length,
        description: "Goods are en route. Awaiting driver/customer proof of delivery confirmation.",
        severity: "info",
        actionLabel: "Track Fleet",
        actionHref: "/fleet",
      });
    }

    return itemsList;
  }, [data]);

  // Next Best Action
  const nextAction = useMemo(() => {
    if (!data) return null;
    if (data.ready_to_dispatch.length > 0) {
      const topOrder = data.ready_to_dispatch[0];
      return {
        title: "Recommended Action: Create Delivery Challan",
        recommendation: `Dispatch Order ${topOrder.number} (${formatINR(topOrder.total)})`,
        reason: "Inventory has been allocated. Generating the challan allows truck loading and gate pass issuance.",
        actionLabel: "Open Order",
        actionHref: `/sales-orders/${topOrder.id}`,
      };
    }
    return null;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Dispatch & Logistics Board"
        subtitle="End-to-end fulfillment: Quotation → Sales Order → Staging → Gate Pass / Challan → In-Transit → Delivery."
        badge={
          data
            ? `${data.ready_to_dispatch.length} ready to ship`
            : undefined
        }
        secondaryActions={[
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

      {/* 3. Next Best Action */}
      {nextAction && (
        <NextBestAction
          title={nextAction.title}
          recommendation={nextAction.recommendation}
          reason={nextAction.reason}
          actionLabel={nextAction.actionLabel}
          actionHref={nextAction.actionHref}
        />
      )}

      {/* 4. Attention Panel */}
      <AttentionPanel
        title="Logistics Bottlenecks & Exceptions"
        items={attentionItems}
        allClearMessage="Fulfillment pipeline is moving smoothly. No delayed dispatches or unassigned staging queues."
      />

      {/* 5. Operations Navigation Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
          Logistics Modules:
        </span>
        <Button asChild variant="outline" size="sm">
          <Link to="/fleet">
            <Truck className="mr-1.5 h-3.5 w-3.5 text-primary" /> Fleet &amp; Drivers
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/trips">
            <Send className="mr-1.5 h-3.5 w-3.5 text-primary" /> Vehicle Trips
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/transfers">
            <WarehouseIcon className="mr-1.5 h-3.5 w-3.5 text-primary" /> Warehouse Transfers
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/stock-counts">
            <Package className="mr-1.5 h-3.5 w-3.5 text-primary" /> Physical Stock Counts
          </Link>
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* 6. Kanban Board Workspaces */}
      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Lane 1: Pending */}
          <div className="flex flex-col rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">Pending Orders</h3>
              </div>
              <Badge variant="outline">{data.pending_orders.length}</Badge>
            </div>
            <div className="space-y-2 flex-1">
              {data.pending_orders.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No pending orders</p>
              ) : (
                data.pending_orders.map((o) => (
                  <Card
                    key={o.id}
                    className="cursor-pointer border-border transition-all hover:border-primary/50 hover:shadow-sm"
                    onClick={() => setInspectedOrder(o)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/sales-orders/${o.id}`}
                          className="font-medium text-primary hover:underline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.number}
                        </Link>
                        <span className="text-xs font-semibold">{formatINR(o.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Awaiting reservation</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Lane 2: Ready to Dispatch */}
          <div className="flex flex-col rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">Ready to Dispatch</h3>
              </div>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                {data.ready_to_dispatch.length}
              </Badge>
            </div>
            <div className="space-y-2 flex-1">
              {data.ready_to_dispatch.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No orders staged</p>
              ) : (
                data.ready_to_dispatch.map((o) => (
                  <Card
                    key={o.id}
                    className="cursor-pointer border-emerald-500/40 bg-card transition-all hover:border-emerald-600 hover:shadow-md"
                    onClick={() => setInspectedOrder(o)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/sales-orders/${o.id}`}
                          className="font-medium text-primary hover:underline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.number}
                        </Link>
                        <span className="text-xs font-semibold text-foreground">{formatINR(o.total)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Staged &amp; Packed
                        </span>
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2">
                          <Link to={`/sales-orders/${o.id}`}>Dispatch &rarr;</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Lane 3: In Transit */}
          <div className="flex flex-col rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-500" />
                <h3 className="text-sm font-semibold text-foreground">In Transit / Dispatched</h3>
              </div>
              <Badge variant="secondary">{data.dispatched.length}</Badge>
            </div>
            <div className="space-y-2 flex-1">
              {data.dispatched.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No active dispatches</p>
              ) : (
                data.dispatched.map((c) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer border-border transition-all hover:border-sky-500 hover:shadow-sm"
                    onClick={() => setInspectedChallan(c)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/sales-orders/${c.sales_order_id}`}
                          className="font-medium text-primary hover:underline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.number}
                        </Link>
                        <Truck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Delivery in progress</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Lane 4: Delivered */}
          <div className="flex flex-col rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-400" />
                <h3 className="text-sm font-semibold text-foreground">Delivered</h3>
              </div>
              <Badge variant="outline">{data.delivered.length}</Badge>
            </div>
            <div className="space-y-2 flex-1">
              {data.delivered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No delivered orders</p>
              ) : (
                data.delivered.map((c) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer border-border/60 bg-muted/30 transition-all hover:bg-card"
                    onClick={() => setInspectedChallan(c)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/sales-orders/${c.sales_order_id}`}
                          className="font-medium text-foreground hover:underline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.number}
                        </Link>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">POD confirmed</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer for Orders */}
      <DetailDrawer
        open={Boolean(inspectedOrder)}
        onOpenChange={(open) => !open && setInspectedOrder(null)}
        title={inspectedOrder ? `Sales Order ${inspectedOrder.number}` : ""}
        badge={<Badge variant="default">Sales Order</Badge>}
        fullRecordHref={inspectedOrder ? `/sales-orders/${inspectedOrder.id}` : undefined}
        metrics={
          inspectedOrder
            ? [{ label: "Order Total", value: formatINR(inspectedOrder.total) }]
            : []
        }
        sections={
          inspectedOrder
            ? [
                {
                  title: "Fulfillment Step",
                  content: (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Order is ready for warehouse dispatch and delivery challan generation.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/sales-orders/${inspectedOrder.id}`}>
                          Generate Delivery Challan <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* Detail Drawer for Challans */}
      <DetailDrawer
        open={Boolean(inspectedChallan)}
        onOpenChange={(open) => !open && setInspectedChallan(null)}
        title={inspectedChallan ? `Delivery Challan ${inspectedChallan.number}` : ""}
        badge={<Badge variant="secondary">Challan</Badge>}
        fullRecordHref={inspectedChallan ? `/sales-orders/${inspectedChallan.sales_order_id}` : undefined}
        metrics={
          inspectedChallan
            ? [{ label: "Type", value: "Delivery Challan" }]
            : []
        }
        sections={
          inspectedChallan
            ? [
                {
                  title: "Dispatch Record",
                  content: (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Linked to sales order. Track driver confirmation and generate final GST tax invoice.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/sales-orders/${inspectedChallan.sales_order_id}`}>
                          View Source Sales Order <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
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
