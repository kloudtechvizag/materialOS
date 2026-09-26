import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { AttentionPanel, type AttentionItem, NextBestAction } from "@/components/workspace";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINRCompact } from "@/lib/format";

interface ApprovalRequest {
  id: string;
}
interface Quotation {
  id: string;
}
interface SalesOrder {
  id: string;
}
interface AgeingLine {
  invoice_id: string;
  amount_due: string;
}
interface LowStockItem {
  item_id: string;
  warehouse_id: string;
}

export function WorkQueue({ enabledModules }: { enabledModules: string[] | undefined }) {
  const hasSales = enabledModules === undefined || enabledModules.includes("sales");
  const hasCollections = enabledModules === undefined || enabledModules.includes("collections");
  const hasInventory = enabledModules === undefined || enabledModules.includes("inventory");

  const approvals = useQuery({
    queryKey: ["work-queue-approvals"],
    queryFn: () => apiFetch<ApprovalRequest[]>("/approvals?status=pending"),
  });
  const quotations = useQuery({
    queryKey: ["work-queue-quotations"],
    queryFn: () => apiFetch<Quotation[]>("/quotations?status=sent"),
    enabled: hasSales,
  });
  const orders = useQuery({
    queryKey: ["work-queue-orders"],
    queryFn: () => apiFetch<SalesOrder[]>("/sales-orders?status=reserved"),
    enabled: hasSales,
  });
  const overdue = useQuery({
    queryKey: ["work-queue-overdue"],
    queryFn: () => apiFetch<AgeingLine[]>("/collections/priority?limit=100"),
    enabled: hasCollections,
    retry: false,
  });
  const lowStock = useQuery({
    queryKey: ["work-queue-low-stock"],
    queryFn: () => apiFetch<LowStockItem[]>("/low-stock-items"),
    enabled: hasInventory,
  });

  const isForbidden = (q: { error: unknown }) => q.error instanceof ApiError && q.error.status === 403;

  const anyLoading =
    approvals.isLoading ||
    (hasSales && (quotations.isLoading || orders.isLoading)) ||
    (hasCollections && overdue.isLoading) ||
    (hasInventory && lowStock.isLoading);

  if (anyLoading) {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  const attentionItems: AttentionItem[] = [];

  const approvalCount = (!isForbidden(approvals) && approvals.data?.length) || 0;
  if (approvalCount > 0) {
    attentionItems.push({
      id: "approvals",
      title: "Pending Commercial Approvals",
      count: approvalCount,
      description: "Credit-limit overrides or blocked orders awaiting managerial sign-off.",
      severity: "critical",
      actionLabel: "Review Approvals",
      actionHref: "/approvals",
    });
  }

  const overdueCount = (hasCollections && !isForbidden(overdue) && overdue.data?.length) || 0;
  if (overdueCount > 0) {
    const overdueTotal = overdue.data!.reduce((sum, l) => sum + Number(l.amount_due || 0), 0);
    attentionItems.push({
      id: "overdue",
      title: "Overdue Invoices",
      count: overdueCount,
      description: `${formatINRCompact(overdueTotal)} outstanding beyond credit terms.`,
      severity: "critical",
      actionLabel: "View Collections",
      actionHref: "/collections",
    });
  }

  const ordersCount = (hasSales && !isForbidden(orders) && orders.data?.length) || 0;
  if (ordersCount > 0) {
    attentionItems.push({
      id: "orders",
      title: "Orders Awaiting Dispatch",
      count: ordersCount,
      description: "Inventory is allocated and ready for delivery challan generation.",
      severity: "warning",
      actionLabel: "Open Dispatch",
      actionHref: "/sales-orders?status=reserved",
    });
  }

  const lowStockCount =
    hasInventory && !isForbidden(lowStock) && lowStock.data
      ? new Set(lowStock.data.map((i) => i.item_id)).size
      : 0;
  if (lowStockCount > 0) {
    attentionItems.push({
      id: "low-stock",
      title: "Items Below Reorder Level",
      count: lowStockCount,
      description: "Stock is nearing safety thresholds. Generate purchase orders to replenish.",
      severity: "warning",
      actionLabel: "Review Inventory",
      actionHref: "/items",
    });
  }

  const quotesCount = (hasSales && !isForbidden(quotations) && quotations.data?.length) || 0;
  if (quotesCount > 0) {
    attentionItems.push({
      id: "quotations",
      title: "Quotations Awaiting Response",
      count: quotesCount,
      description: "Open quotes sent to prospective or existing buyers.",
      severity: "info",
      actionLabel: "Follow Up",
      actionHref: "/quotations?status=sent",
    });
  }

  // Next Best Action determination based on business urgency
  let nextAction: { title: string; recommendation: string; reason: string; actionLabel: string; actionHref: string } | null = null;
  if (approvalCount > 0) {
    nextAction = {
      title: "Recommended Action: Commercial Approval",
      recommendation: `Resolve ${approvalCount} pending credit-limit override${approvalCount > 1 ? "s" : ""}`,
      reason: "Blocked orders cannot proceed to warehouse reservation or delivery without approval.",
      actionLabel: "Review Approvals",
      actionHref: "/approvals",
    };
  } else if (overdueCount > 0) {
    nextAction = {
      title: "Recommended Action: Cash Collection",
      recommendation: `Follow up on ${overdueCount} high-priority overdue customer invoice${overdueCount > 1 ? "s" : ""}`,
      reason: "Accelerating collections improves Days Sales Outstanding (DSO) and working capital.",
      actionLabel: "Open Collections",
      actionHref: "/collections",
    };
  } else if (ordersCount > 0) {
    nextAction = {
      title: "Recommended Action: Order Dispatch",
      recommendation: `Dispatch ${ordersCount} order${ordersCount > 1 ? "s" : ""} ready for shipment`,
      reason: "Reserved items are prepared for staging, gate pass, and delivery challan issuance.",
      actionLabel: "Generate Challan",
      actionHref: "/dispatch-board",
    };
  } else if (lowStockCount > 0) {
    nextAction = {
      title: "Recommended Action: Procurement Replenishment",
      recommendation: `Raise purchase orders for ${lowStockCount} low-stock catalog item${lowStockCount > 1 ? "s" : ""}`,
      reason: "Stock levels have dropped below configured safety points.",
      actionLabel: "Create Purchase Order",
      actionHref: "/purchase-orders",
    };
  }

  return (
    <div className="space-y-4">
      {nextAction && (
        <NextBestAction
          title={nextAction.title}
          recommendation={nextAction.recommendation}
          reason={nextAction.reason}
          actionLabel={nextAction.actionLabel}
          actionHref={nextAction.actionHref}
        />
      )}
      <AttentionPanel
        title="Action Center & Exceptions"
        items={attentionItems}
        allClearMessage="All systems operational. No overdue invoices, pending approvals, or critical stock exceptions."
      />
    </div>
  );
}
