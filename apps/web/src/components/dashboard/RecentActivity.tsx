import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useDashboardPrefsStore } from "@/store/dashboardPrefs";
import { cn } from "@/lib/utils";

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

const ROWS_SHOWN = 8;

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

// Real, operationally-relevant events -- but a scheduled backup writes
// several rows (created -> running -> completed) every run, which can
// dominate a small tenant's whole recent-activity window. Never
// dropped (see NOISE_TABLES for that); collapsed into one summary row
// per table instead, same "retain but don't let it overwhelm" the
// request asked for.
const SYSTEM_GROUP_TABLES: Record<string, { label: string; href: string }> = {
  backups: { label: "backup", href: "/operations/backups" },
  notification_deliveries: { label: "notification", href: "/operations/notification-rules" },
};

type DisplayRow =
  | { kind: "log"; id: string; log: AuditLog }
  | { kind: "group"; id: string; tableName: string; count: number; occurredAt: string };

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

/** Folds consecutive/nearby SYSTEM_GROUP_TABLES rows into one summary
 * row per table (positioned at that group's most recent event, so
 * overall recency ordering still reads correctly), leaving every
 * genuine business-entity row untouched and individually visible. */
function buildDisplayRows(logs: AuditLog[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const groupIndexByTable = new Map<string, number>();

  for (const log of logs) {
    if (SYSTEM_GROUP_TABLES[log.table_name]) {
      const existingIndex = groupIndexByTable.get(log.table_name);
      if (existingIndex !== undefined && rows[existingIndex].kind === "group") {
        const group = rows[existingIndex] as Extract<DisplayRow, { kind: "group" }>;
        group.count += 1;
        continue;
      }
      groupIndexByTable.set(log.table_name, rows.length);
      rows.push({ kind: "group", id: `group-${log.table_name}`, tableName: log.table_name, count: 1, occurredAt: log.occurred_at });
      continue;
    }
    rows.push({ kind: "log", id: log.id, log });
  }
  return rows;
}

/** Real events off the audit_trigger_fn DB trigger (every write since
 * Slice 0 already lands here -- see api/v1/audit.py's own docstring),
 * translated into a human-readable line instead of the raw table_name/
 * action/JSON the endpoint returns. No activity is invented: an entry
 * only appears here because a real INSERT/UPDATE/DELETE happened.
 *
 * Collapsible, defaulting closed (compact-by-default for first-time
 * users): the panel's own expand/collapse preference persists via
 * useDashboardPrefsStore, independent of this query -- toggling never
 * refetches, since the queryKey never changes. */
export function RecentActivity() {
  const expanded = useDashboardPrefsStore((s) => s.recentActivityExpanded);
  const setExpanded = useDashboardPrefsStore((s) => s.setRecentActivityExpanded);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recent-activity"],
    // Over-fetch so filtering out NOISE_TABLES and grouping system
    // tables client-side still leaves a full display list rather than
    // a short one on a chatty tenant.
    queryFn: () =>
      apiFetch<AuditLog[]>("/audit-logs?limit=75").then((rows) => buildDisplayRows(rows.filter((r) => !NOISE_TABLES.has(r.table_name)))),
    retry: false,
  });
  // Best-effort name resolution -- a role without users.view still sees
  // the activity feed, just without the "by <name>" clause.
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<TenantUser[]>("/users"),
    retry: false,
    enabled: expanded,
  });
  const userById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const forbidden = error instanceof ApiError && error.status === 403;
  const shown = data?.slice(0, ROWS_SHOWN) ?? [];
  const hasMore = (data?.length ?? 0) > shown.length;
  const panelId = "recent-activity-panel";

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-sm font-semibold">Recent activity</span>
        <span className="flex items-center gap-2">
          {data && <span className="text-xs text-muted-foreground">{data.length} event{data.length === 1 ? "" : "s"}</span>}
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </span>
      </button>

      <div
        id={panelId}
        className={cn("grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0">
          <div className="border-t border-border px-4 py-3">
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
                {shown.map((row) => {
                  if (row.kind === "group") {
                    const meta = SYSTEM_GROUP_TABLES[row.tableName];
                    const content = (
                      <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm">
                        <span className="truncate text-muted-foreground">
                          {row.count} {meta.label}{row.count === 1 ? "" : " events"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(new Date(row.occurredAt).getTime())}</span>
                      </div>
                    );
                    return (
                      <Link key={row.id} to={meta.href} className="block rounded-md transition-colors hover:bg-accent/40">
                        {content}
                      </Link>
                    );
                  }

                  const log = row.log;
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
                    <Link key={row.id} to={href} className="block rounded-md transition-colors hover:bg-accent/40">
                      {content}
                    </Link>
                  ) : (
                    <div key={row.id}>{content}</div>
                  );
                })}

                {hasMore && (
                  <Link to="/operations/audit-log" className="block px-2 pt-2 text-xs font-medium text-primary hover:underline">
                    View all activity &rarr;
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
