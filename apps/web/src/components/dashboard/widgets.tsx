import { Kpi } from "@/components/dashboard/Kpi";
import { formatINRCompact } from "@/lib/format";

export interface DashboardSummary {
  total_outstanding: string;
  total_invoiced: string;
  open_quotations: number;
  open_sales_orders: number;
  posted_invoices: number;
  active_items: number;
  active_customers: number;
  todays_sales?: string;
  todays_cash?: string;
  todays_upi?: string;
  todays_card?: string;
  near_expiry_count?: number;
  jobs_due_today?: number;
  jobs_overdue?: number;
  jobs_in_production?: number;
  inventory_value?: string;
  has_overdue_receivables?: boolean;
}

/** Registry keyed by IndustryProfile.dashboard_widgets entries. Building
 * Materials' 6 widgets are the original DashboardPage KPIs, unchanged --
 * this is a formalization (ADR-010), not a redesign. An unknown key
 * (future profile referencing a widget not yet built) is skipped by the
 * caller rather than crashing the page. */
export const DASHBOARD_WIDGETS: Record<string, (data: DashboardSummary) => React.ReactNode> = {
  outstanding: (data) => (
    <Kpi
      key="outstanding"
      label="Receivables"
      value={formatINRCompact(data.total_outstanding)}
      to="/collections"
      hint={data.has_overdue_receivables ? "Needs review" : "All current"}
      hintTone={data.has_overdue_receivables ? "warning" : "positive"}
    />
  ),
  invoiced: (data) => <Kpi key="invoiced" label="Total invoiced" value={formatINRCompact(data.total_invoiced)} hint="All posted invoices" />,
  open_quotations: (data) => (
    <Kpi key="open_quotations" label="Open quotations" value={data.open_quotations} to="/quotations" hint={data.open_quotations > 0 ? "Awaiting action" : "None pending"} />
  ),
  open_sales_orders: (data) => (
    <Kpi key="open_sales_orders" label="Open orders" value={data.open_sales_orders} to="/sales-orders" hint={data.open_sales_orders > 0 ? "In progress" : "None open"} />
  ),
  active_items: (data) => <Kpi key="active_items" label="Active items" value={data.active_items} to="/items" />,
  active_customers: (data) => <Kpi key="active_customers" label="Active customers" value={data.active_customers} to="/customers" />,
  inventory_value: (data) => (
    <Kpi key="inventory_value" label="Inventory value" value={data.inventory_value ? formatINRCompact(data.inventory_value) : "—"} to="/items" hint="View inventory" />
  ),
  todays_sales: (data) => <Kpi key="todays_sales" label="Today's sales" value={formatINRCompact(data.todays_sales ?? "0")} to="/pos" />,
  todays_cash: (data) => <Kpi key="todays_cash" label="Today's cash" value={formatINRCompact(data.todays_cash ?? "0")} />,
  todays_upi: (data) => <Kpi key="todays_upi" label="Today's UPI" value={formatINRCompact(data.todays_upi ?? "0")} />,
  todays_card: (data) => <Kpi key="todays_card" label="Today's card" value={formatINRCompact(data.todays_card ?? "0")} />,
  near_expiry: (data) => (
    <Kpi
      key="near_expiry"
      label="Expiring batches"
      value={data.near_expiry_count ?? 0}
      to="/items"
      hint={(data.near_expiry_count ?? 0) > 0 ? "Within 60 days" : "None expiring soon"}
      hintTone={(data.near_expiry_count ?? 0) > 0 ? "warning" : "muted"}
    />
  ),
  jobs_due_today: (data) => <Kpi key="jobs_due_today" label="Jobs due today" value={data.jobs_due_today ?? 0} to="/production-board" />,
  jobs_overdue: (data) => (
    <Kpi
      key="jobs_overdue"
      label="Jobs overdue"
      value={data.jobs_overdue ?? 0}
      to="/production-board"
      hint={(data.jobs_overdue ?? 0) > 0 ? "Needs review" : undefined}
      hintTone="warning"
    />
  ),
  jobs_in_production: (data) => <Kpi key="jobs_in_production" label="In production" value={data.jobs_in_production ?? 0} to="/production-board" />,
};

/** Building Materials' widget list, duplicated from the seeded
 * IndustryProfile so the dashboard has something sensible to render
 * before the profile finishes loading (same "show everything while
 * loading" default as buildNavigation()). */
export const DEFAULT_DASHBOARD_WIDGETS = [
  "outstanding",
  "invoiced",
  "open_quotations",
  "open_sales_orders",
  "inventory_value",
  "active_customers",
];
