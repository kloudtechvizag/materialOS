import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";

interface AuditLog {
  id: string;
  table_name: string;
  row_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by_user_id: string | null;
  occurred_at: string;
}

interface TenantUser {
  id: string;
  full_name: string;
}

interface TableMeta {
  label: string;
  toHref?: (rowId: string, data: Record<string, unknown> | null) => string;
}

// Covers the tables that read as genuine business activity (spec's own
// example list: quotation/order/invoice/payment/stock/dispatch/
// customer) -- every other audited table (roles, warehouses, financial
// years, ...) still shows, just with a generic label and no deep link,
// rather than this list trying to special-case all ~40 audited tables.
const TABLE_META: Record<string, TableMeta> = {
  quotations: { label: "Quotation", toHref: (id) => `/quotations/${id}` },
  sales_orders: { label: "Sales order", toHref: (id) => `/sales-orders/${id}` },
  invoices: { label: "Invoice", toHref: (id) => `/invoices/${id}` },
  customers: { label: "Customer", toHref: (id) => `/customers/${id}` },
  suppliers: { label: "Supplier", toHref: (id) => `/suppliers/${id}` },
  purchase_orders: { label: "Purchase order", toHref: (id) => `/purchase-orders/${id}` },
  receipts: { label: "Payment", toHref: () => "/collections" },
  delivery_challans: { label: "Dispatch", toHref: (_id, data) => (data?.sales_order_id ? `/sales-orders/${data.sales_order_id}` : "/sales-orders") },
  stock_transfers: { label: "Stock transfer", toHref: () => "/transfers" },
  items: { label: "Item", toHref: () => "/items" },
  branches: { label: "Branch", toHref: () => "/branches" },
  warehouses: { label: "Warehouse", toHref: () => "/warehouses" },
  companies: { label: "Company", toHref: () => "/company-settings" },
  users: { label: "User", toHref: () => "/users" },
};

// Real audited tables, but pure internal bookkeeping a business user
// never cares about -- filtered client-side (not hidden data, just not
// worth a row) rather than the backend inventing a "business-relevant"
// concept the audit trigger itself doesn't know about.
const NOISE_TABLES = new Set(["role_permissions", "user_roles", "roles", "doc_number_counters"]);

function friendlyTableLabel(tableName: string): string {
  // Curated entries get a real singular label ("Quotation"); anything
  // else keeps its plain plural table name rather than a naive (and
  // frequently wrong -- "companies" -> "companie") singularization.
  return TABLE_META[tableName]?.label ?? tableName.replace(/_/g, " ");
}

function recordReference(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  if (typeof data.number === "string") return data.number;
  if (typeof data.name === "string") return data.name;
  return null;
}

function describe(log: AuditLog): string {
  const label = friendlyTableLabel(log.table_name);
  const ref = recordReference(log.new_data ?? log.old_data);
  const subject = ref ? `${label} ${ref}` : label;

  if (log.action === "INSERT") return `${subject} created`;
  if (log.action === "DELETE") return `${subject} deleted`;

  const oldStatus = log.old_data?.status;
  const newStatus = log.new_data?.status;
  if (typeof newStatus === "string" && newStatus !== oldStatus) {
    return `${subject} marked ${newStatus.replace(/_/g, " ")}`;
  }
  return `${subject} updated`;
}

/** Real events off the audit_trigger_fn DB trigger (every write since
 * Slice 0 already lands here -- see api/v1/audit.py's own docstring),
 * translated into a human-readable line instead of the raw table_name/
 * action/JSON the endpoint returns. No activity is invented: an entry
 * only appears here because a real INSERT/UPDATE/DELETE happened. */
export function RecentActivity() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recent-activity"],
    // Over-fetch so filtering out NOISE_TABLES client-side still leaves
    // a full 15 real rows rather than a short list on a chatty tenant.
    queryFn: () => apiFetch<AuditLog[]>("/audit-logs?limit=75").then((rows) => rows.filter((r) => !NOISE_TABLES.has(r.table_name)).slice(0, 15)),
    retry: false,
  });
  // Best-effort name resolution -- a role without users.view still sees
  // the activity feed, just without the "by <name>" clause.
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<TenantUser[]>("/users"),
    retry: false,
  });
  const userById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Recent activity</p>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      )}

      {error && !forbidden && <ErrorState error={error} onRetry={() => refetch()} />}
      {forbidden && <p className="text-sm text-muted-foreground">You don&apos;t have permission to view the activity log.</p>}

      {data && data.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          <span>No activity yet.</span>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-1">
          {data.map((log) => {
            const meta = TABLE_META[log.table_name];
            const href = meta?.toHref?.(log.row_id, log.new_data ?? log.old_data);
            const userName = log.changed_by_user_id ? userById.get(log.changed_by_user_id) : undefined;
            const content = (
              <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm">
                <span className="truncate">
                  {describe(log)}
                  {userName && <span className="text-muted-foreground"> &middot; {userName}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(new Date(log.occurred_at).getTime())}</span>
              </div>
            );
            return href ? (
              <Link key={log.id} to={href} className="block transition-colors hover:bg-accent/40 rounded-md">
                {content}
              </Link>
            ) : (
              <div key={log.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
