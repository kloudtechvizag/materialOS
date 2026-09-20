import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
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

interface Row {
  key: string;
  label: string;
  href: string;
  count: number;
  detail?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function QueueRow({ row }: { row: Row }) {
  if (row.isLoading) return <Skeleton className="h-11 w-full" />;
  if (row.isError) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <span>{row.label} couldn&apos;t load.</span>
        <button className="text-primary hover:underline" onClick={row.onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (row.count === 0) return null;
  return (
    <Link
      to={row.href}
      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span>{row.label}</span>
      <span className="flex items-center gap-2">
        {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">
          {row.count}
        </span>
      </span>
    </Link>
  );
}

/** "Needs Attention" -- deliberately five independent queries, not one
 * aggregate endpoint: a slow or failing category (per the dashboard's
 * own functional requirements) must not block the others, and each
 * reuses a real, already-tested endpoint rather than a bespoke rollup.
 * Only categories relevant to the active profile's enabled_modules are
 * queried at all; a category with zero results renders nothing (see
 * QueueRow) rather than a padded "0" row. */
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

  const rows: Row[] = [
    {
      key: "approvals", label: "Pending approvals", href: "/approvals",
      count: approvals.data?.length ?? 0, isLoading: approvals.isLoading,
      isError: approvals.isError && !isForbidden(approvals), onRetry: () => approvals.refetch(),
    },
    ...(hasSales
      ? [
          {
            key: "quotations", label: "Quotations awaiting response", href: "/quotations?status=sent",
            count: quotations.data?.length ?? 0, isLoading: quotations.isLoading,
            isError: quotations.isError && !isForbidden(quotations), onRetry: () => quotations.refetch(),
          },
          {
            key: "orders", label: "Orders awaiting dispatch", href: "/sales-orders?status=reserved",
            count: orders.data?.length ?? 0, isLoading: orders.isLoading,
            isError: orders.isError && !isForbidden(orders), onRetry: () => orders.refetch(),
          },
        ]
      : []),
    ...(hasCollections
      ? [
          {
            key: "overdue", label: "Overdue invoices", href: "/collections",
            count: overdue.data?.length ?? 0,
            detail: overdue.data && overdue.data.length > 0
              ? formatINRCompact(overdue.data.reduce((sum, l) => sum + Number(l.amount_due), 0))
              : undefined,
            isLoading: overdue.isLoading, isError: overdue.isError && !isForbidden(overdue), onRetry: () => overdue.refetch(),
          },
        ]
      : []),
    ...(hasInventory
      ? [
          {
            key: "low-stock", label: "Low-stock items", href: "/items",
            count: new Set((lowStock.data ?? []).map((i) => i.item_id)).size,
            isLoading: lowStock.isLoading, isError: lowStock.isError && !isForbidden(lowStock), onRetry: () => lowStock.refetch(),
          },
        ]
      : []),
  ];

  const anyLoading = rows.some((r) => r.isLoading);
  const allClear = !anyLoading && rows.every((r) => r.isError || r.count === 0);

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Needs attention</p>
      {allClear ? (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Nothing needs attention right now.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <QueueRow key={row.key} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
