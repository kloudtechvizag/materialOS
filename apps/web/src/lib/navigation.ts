import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  Building,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  Factory,
  FileSpreadsheet,
  FileText,
  History,
  KanbanSquare,
  LayoutDashboard,
  MapPin,
  Package,
  Printer,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Target,
  Truck,
  UploadCloud,
  Users,
  Wallet,
} from "lucide-react";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Exact-match only (react-router NavLink `end`) -- just Dashboard at "/". */
  end?: boolean;
  badge?: string | number;
  /** Not enforced yet (no RBAC in the app) -- present so a permission or
   * role gate can filter the resolved nav later without touching every
   * sidebar variant that renders it. */
  permission?: string;
  /** IndustryProfile.enabled_modules key gating this item. Undefined =
   * always visible ("core" -- e.g. Dashboard, Customers, Company
   * settings), not industry-specific. */
  module?: string;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

/** Every item the app can show, across every industry profile -- desktop,
 * collapsed desktop, and the mobile drawer all render from
 * buildNavigation()'s output, so a new module is one entry here (plus
 * the profile's enabled_modules) rather than three hardcoded lists to
 * keep in sync. Icons are real components, not JSON-serializable, so
 * this stays a frontend-owned registry -- IndustryProfile only says
 * *which* items to keep (enabled_modules), not what they look like. */
const ALL_NAV_SECTIONS: NavigationSection[] = [
  {
    id: "sell",
    label: "Sell",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
      { id: "leads", label: "Leads", href: "/leads", icon: Target, permission: "leads.view", module: "sales" },
      { id: "pos", label: "POS", href: "/pos", icon: CreditCard, module: "pos" },
      { id: "quotations", label: "Quotations", href: "/quotations", icon: FileText, module: "sales" },
      { id: "collections", label: "Collections", href: "/collections", icon: Banknote, module: "collections" },
      { id: "field-sales", label: "Field sales", href: "/field-sales", icon: MapPin, module: "field_sales" },
      { id: "approvals", label: "Approvals", href: "/approvals", icon: ShieldCheck },
    ],
  },
  {
    id: "printing",
    label: "Printing",
    items: [
      { id: "production-board", label: "Production board", href: "/production-board", icon: KanbanSquare, module: "printing" },
      { id: "print-jobs", label: "Print jobs", href: "/print-jobs", icon: Printer, module: "printing" },
      { id: "print-machines", label: "Machines", href: "/print-machines", icon: Factory, module: "printing" },
    ],
  },
  {
    id: "dispatch",
    label: "Dispatch",
    items: [
      { id: "dispatch-board", label: "Dispatch board", href: "/dispatch-board", icon: Truck, module: "dispatch" },
      { id: "trips", label: "Trips", href: "/trips", icon: Truck, module: "fleet" },
      { id: "fleet", label: "Fleet", href: "/fleet", icon: Truck, module: "fleet" },
      { id: "stock-counts", label: "Stock counts", href: "/stock-counts", icon: ClipboardList, module: "inventory" },
      { id: "transfers", label: "Transfers", href: "/transfers", icon: ArrowLeftRight, module: "inventory" },
    ],
  },
  {
    id: "buy",
    label: "Buy",
    items: [
      { id: "purchase-orders", label: "Purchase orders", href: "/purchase-orders", icon: ShoppingCart, module: "purchase" },
      { id: "suppliers", label: "Suppliers", href: "/suppliers", icon: Factory, module: "purchase" },
    ],
  },
  {
    id: "books",
    label: "Books",
    items: [
      { id: "financial-reports", label: "Financial reports", href: "/books", icon: FileSpreadsheet, module: "accounting" },
      { id: "gst", label: "GST filing", href: "/gst", icon: Receipt, module: "gst" },
    ],
  },
  {
    id: "people",
    label: "People & Payroll",
    items: [
      { id: "people-overview", label: "Overview", href: "/people", icon: LayoutDashboard, end: true, permission: "employees.view" },
      { id: "people-employees", label: "Employees", href: "/people/employees", icon: Users, permission: "employees.view" },
      { id: "people-attendance", label: "Attendance", href: "/people/attendance", icon: Clock, permission: "attendance.view" },
      { id: "people-leave", label: "Leave", href: "/people/leave", icon: CalendarDays, permission: "leave.view" },
      { id: "people-payroll", label: "Payroll", href: "/people/payroll", icon: Wallet, permission: "payroll.view" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "command-center", label: "Command center", href: "/operations", icon: LayoutDashboard },
      { id: "backups", label: "Backups", href: "/operations/backups", icon: Database, permission: "backup.view" },
      { id: "audit-log", label: "Audit log", href: "/operations/audit-log", icon: History, permission: "audit.view" },
      { id: "notification-rules", label: "Notification rules", href: "/operations/notification-rules", icon: Bell, permission: "notification_rules.manage" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      { id: "items", label: "Items", href: "/items", icon: Package },
      { id: "customers", label: "Customers", href: "/customers", icon: Users },
      { id: "projects", label: "Projects", href: "/projects", icon: Building, module: "projects" },
      { id: "imports", label: "Import from Tally/Busy", href: "/imports", icon: UploadCloud },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2 },
      { id: "users", label: "Users", href: "/users", icon: Users },
      { id: "company-settings", label: "Company settings", href: "/company-settings", icon: Settings },
      { id: "industry-config", label: "Industry", href: "/settings/industry", icon: SlidersHorizontal },
      { id: "subscription", label: "Subscription", href: "/settings/subscription", icon: CreditCard, permission: "subscription.view" },
      { id: "receipt-settings", label: "Receipts", href: "/settings/receipts", icon: Printer, permission: "receipts.manage" },
    ],
  },
];

/** Filters ALL_NAV_SECTIONS down to what a profile actually enables,
 * and relabels the handful of nav items whose name genuinely varies
 * by industry (IndustryProfile.terminology, ADR-010) -- "Items" reads
 * "Medicines" for a pharmacy, "Materials" for a print shop, and so on.
 * `enabledModules === undefined` (profile not loaded yet) shows
 * everything rather than flashing an empty sidebar while it loads. */
export function buildNavigation(enabledModules: string[] | undefined, terminology?: Record<string, string>): NavigationSection[] {
  const itemsLabel = terminology?.items_label;
  return ALL_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => !item.module || enabledModules === undefined || enabledModules.includes(item.module))
      .map((item) => (item.id === "items" && itemsLabel ? { ...item, label: itemsLabel } : item)),
  })).filter((section) => section.items.length > 0);
}

/** Exported for callers that need "everything" without a profile (e.g.
 * computing default expand/collapse state) -- prefer buildNavigation()
 * for anything user-facing. */
export const NAVIGATION_CONFIG = ALL_NAV_SECTIONS;

/** Mirrors react-router's own NavLink matching so "which section owns the
 * active route" agrees with which link NavLink actually highlights. */
export function isItemActive(pathname: string, item: NavigationItem): boolean {
  if (item.end) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findActiveSectionId(pathname: string, sections: NavigationSection[] = ALL_NAV_SECTIONS): string | undefined {
  return sections.find((section) => section.items.some((item) => isItemActive(pathname, item)))?.id;
}
