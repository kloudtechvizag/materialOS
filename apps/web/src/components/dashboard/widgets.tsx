import { AlertTriangle, Banknote, Clock, CreditCard, FileText, KanbanSquare, Package, Smartphone, TrendingUp, Users } from "lucide-react";

import { Kpi } from "@/components/dashboard/Kpi";
import { formatINR } from "@/lib/format";

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
}

/** Registry keyed by IndustryProfile.dashboard_widgets entries. Building
 * Materials' 6 widgets are the original DashboardPage KPIs, unchanged --
 * this is a formalization (ADR-010), not a redesign. An unknown key
 * (future profile referencing a widget not yet built) is skipped by the
 * caller rather than crashing the page. */
export const DASHBOARD_WIDGETS: Record<string, (data: DashboardSummary) => React.ReactNode> = {
  outstanding: (data) => (
    <Kpi key="outstanding" icon={TrendingUp} label="Total outstanding" value={formatINR(data.total_outstanding)} to="/customers" />
  ),
  invoiced: (data) => <Kpi key="invoiced" icon={TrendingUp} label="Total invoiced" value={formatINR(data.total_invoiced)} />,
  open_quotations: (data) => (
    <Kpi key="open_quotations" icon={FileText} label="Open quotations" value={data.open_quotations} to="/quotations" />
  ),
  open_sales_orders: (data) => (
    <Kpi key="open_sales_orders" icon={FileText} label="Open sales orders" value={data.open_sales_orders} />
  ),
  active_items: (data) => <Kpi key="active_items" icon={Package} label="Active items" value={data.active_items} to="/items" />,
  active_customers: (data) => (
    <Kpi key="active_customers" icon={Users} label="Active customers" value={data.active_customers} to="/customers" />
  ),
  todays_sales: (data) => (
    <Kpi key="todays_sales" icon={TrendingUp} label="Today's sales" value={formatINR(data.todays_sales ?? "0")} to="/pos" />
  ),
  todays_cash: (data) => <Kpi key="todays_cash" icon={Banknote} label="Today's cash" value={formatINR(data.todays_cash ?? "0")} />,
  todays_upi: (data) => <Kpi key="todays_upi" icon={Smartphone} label="Today's UPI" value={formatINR(data.todays_upi ?? "0")} />,
  todays_card: (data) => <Kpi key="todays_card" icon={CreditCard} label="Today's card" value={formatINR(data.todays_card ?? "0")} />,
  near_expiry: (data) => (
    <Kpi key="near_expiry" icon={AlertTriangle} label="Batches expiring within 60 days" value={data.near_expiry_count ?? 0} to="/items" />
  ),
  jobs_due_today: (data) => (
    <Kpi key="jobs_due_today" icon={Clock} label="Jobs due today" value={data.jobs_due_today ?? 0} to="/production-board" />
  ),
  jobs_overdue: (data) => (
    <Kpi key="jobs_overdue" icon={AlertTriangle} label="Jobs overdue" value={data.jobs_overdue ?? 0} to="/production-board" />
  ),
  jobs_in_production: (data) => (
    <Kpi key="jobs_in_production" icon={KanbanSquare} label="Jobs in production" value={data.jobs_in_production ?? 0} to="/production-board" />
  ),
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
  "active_items",
  "active_customers",
];
