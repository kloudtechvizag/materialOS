import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  Building,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  Coins,
  Cpu,
  CreditCard,
  Database,
  Factory,
  FileMinus,
  FlaskConical,
  FileSpreadsheet,
  FileText,
  History,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPin,
  Microscope,
  Package,
  Printer,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Store,
  Target,
  Truck,
  UploadCloud,
  Users,
  Wallet,
  Warehouse,
  Webhook,
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

/** Rendered flat, above every module section and outside any accordion
 * -- these are the only two items every business profile shows
 * regardless of industry, so they don't belong nested inside "Sell" (or
 * any other module-specific section) where they'd imply they're a Sell
 * capability rather than global navigation. See SidebarNav.tsx. */
export const GLOBAL_NAV_ITEMS: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
  { id: "approvals", label: "Approvals", href: "/approvals", icon: ShieldCheck },
];

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
      { id: "leads", label: "Leads", href: "/leads", icon: Target, permission: "leads.view", module: "sales" },
      { id: "pos", label: "POS", href: "/pos", icon: CreditCard, module: "pos" },
      { id: "quotations", label: "Quotations", href: "/quotations", icon: FileText, module: "sales" },
      { id: "collections", label: "Collections", href: "/collections", icon: Banknote, module: "collections" },
      { id: "field-sales", label: "Field sales", href: "/field-sales", icon: MapPin, module: "field_sales" },
    ],
  },
  {
    id: "printing",
    label: "Printing",
    items: [
      { id: "production-board", label: "Production board", href: "/production-board", icon: KanbanSquare, module: "printing" },
      { id: "print-jobs", label: "Print jobs", href: "/print-jobs", icon: Printer, module: "printing" },
      { id: "print-machines", label: "Machines", href: "/print-machines", icon: Factory, module: "printing" },
      // The Item catalog, relabeled "Materials" for this profile (paper,
      // ink, ...) -- lives here, not in generic Setup, because for a
      // print shop it IS this section's own stock, not administrative
      // config. See GENERIC_ITEMS_HOME_MODULES.
      { id: "items", label: "Items", href: "/items", icon: Package, module: "printing" },
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
      // Only relevant where individual units carry a serial/IMEI and a
      // warranty/RMA history (SerialUnit's own docstring names exactly
      // these four profiles) -- not universal, was unguarded before.
      { id: "serial-rma", label: "Serial numbers & RMA", href: "/serial-rma", icon: Smartphone, module: "serial_tracking" },
    ],
  },
  {
    id: "books",
    label: "Books",
    items: [
      { id: "financial-reports", label: "Financial reports", href: "/books", icon: FileSpreadsheet, module: "accounting" },
      { id: "gst", label: "GST filing", href: "/gst", icon: Receipt, module: "gst" },
      // Both read straight off sales-returns/purchase-returns and the
      // report datasets are all sales/purchase/inventory/GST-based (see
      // services/reports.py) -- meaningless without "accounting", which
      // every profile except laboratory has, so this only changes
      // laboratory's sidebar.
      { id: "credit-debit-notes", label: "Credit & debit notes", href: "/credit-debit-notes", icon: FileMinus, module: "accounting" },
      { id: "reports", label: "Report builder", href: "/reports", icon: BarChart3, module: "accounting" },
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
    id: "laboratory",
    label: "Laboratory",
    items: [
      { id: "lab-samples", label: "Samples", href: "/lab/samples", icon: FlaskConical, module: "laboratory" },
      { id: "lab-test-catalog", label: "Test catalog", href: "/lab/test-catalog", icon: Microscope, module: "laboratory" },
      { id: "lab-specifications", label: "Specifications", href: "/lab/specifications", icon: ListChecks, module: "laboratory" },
      { id: "lab-worksheets", label: "Worksheets", href: "/lab/worksheets", icon: ClipboardList, module: "laboratory" },
      { id: "lab-instruments", label: "Instruments", href: "/lab/instruments", icon: Cpu, module: "laboratory" },
      { id: "lab-storage", label: "Storage", href: "/lab/storage", icon: Warehouse, module: "laboratory" },
      // The Item catalog, relabeled "Reagents & Supplies" for this
      // profile -- lives here, not in generic Setup, because for a lab
      // it IS this section's own inventory, not administrative config.
      // See GENERIC_ITEMS_HOME_MODULES.
      { id: "items", label: "Items", href: "/items", icon: Package, module: "laboratory" },
      { id: "lab-qc", label: "Quality control", href: "/lab/qc", icon: ShieldCheck, module: "laboratory" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "command-center", label: "Command center", href: "/operations", icon: LayoutDashboard, end: true },
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
      // A Tally/Busy accounting-software migration wizard (ImportBatch's
      // own docstring) -- meaningless without "accounting" (see Books).
      { id: "imports", label: "Import from Tally/Busy", href: "/imports", icon: UploadCloud, module: "accounting" },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2 },
      { id: "users", label: "Users", href: "/users", icon: Users },
      { id: "company-settings", label: "Company settings", href: "/company-settings", icon: Settings },
      { id: "industry-config", label: "Industry", href: "/settings/industry", icon: SlidersHorizontal },
      { id: "subscription", label: "Subscription", href: "/settings/subscription", icon: CreditCard, permission: "subscription.view" },
      { id: "capabilities", label: "Capabilities", href: "/settings/capabilities", icon: Store, permission: "subscription.view" },
      // Configures the payment-receipt template (POS/sales receipts) --
      // meaningless without "accounting" (see Books).
      { id: "receipt-settings", label: "Receipts", href: "/settings/receipts", icon: Printer, permission: "receipts.manage", module: "accounting" },
      // Jewellery-only: gold/silver rate entry for weight-priced items
      // (resolve_price()'s jewellery branch, ADR-010's jewellery
      // addendum) -- was showing for every profile before this fix.
      { id: "metal-rates", label: "Metal rates", href: "/settings/metal-rates", icon: Coins, permission: "items.edit", module: "jewellery" },
      { id: "webhooks", label: "Webhooks", href: "/settings/webhooks", icon: Webhook, permission: "webhooks.view" },
      { id: "support", label: "Support", href: "/support", icon: LifeBuoy },
    ],
  },
];

/** Profiles whose own dedicated section (laboratory, printing) carries
 * its own copy of the "items" entry above, module-gated to that
 * section only -- for these, the Item catalog isn't generic admin
 * config, it's that domain's own inventory (Reagents & Supplies,
 * Materials), so it doesn't belong under Setup too. buildNavigation
 * drops Setup's generic "items" entry whenever one of these modules is
 * active, so it never appears twice under two different section
 * labels for the same catalog. Every other profile keeps it in Setup,
 * unchanged, since it has no more specific section to live in. */
const GENERIC_ITEMS_HOME_MODULES = ["laboratory", "printing"];

/** For a profile with its own dedicated section (laboratory ->
 * "laboratory", printing -> "printing"), that section is what the
 * tenant's business actually IS -- it belongs directly under the two
 * global items (Dashboard, Approvals), ahead of cross-cutting sections
 * like People & Payroll and Setup that exist for every business
 * regardless of industry. Every other profile has no single section
 * that plays this role (Sell/Buy/Dispatch/Books together form its
 * primary workflow, not one section), so their relative order is left
 * exactly as ALL_NAV_SECTIONS declares it. */
const PRIMARY_SECTION_BY_MODULE: Record<string, string> = {
  laboratory: "laboratory",
  printing: "printing",
};

/** Same filter GLOBAL_NAV_ITEMS would need if a global item ever gains a
 * module gate -- neither does today (that's the point of "global"), but
 * this keeps the two item lists behaving identically instead of one
 * silently skipping module/permission filtering. */
export function buildGlobalNavItems(enabledModules: string[] | undefined): NavigationItem[] {
  return GLOBAL_NAV_ITEMS.filter((item) => !item.module || enabledModules === undefined || enabledModules.includes(item.module));
}

/** Filters ALL_NAV_SECTIONS down to what a profile actually enables,
 * and relabels the handful of nav items whose name genuinely varies
 * by industry (IndustryProfile.terminology, ADR-010) -- "Items" reads
 * "Medicines" for a pharmacy, "Materials" for a print shop, and so on.
 * `enabledModules === undefined` (profile not loaded yet) shows
 * everything rather than flashing an empty sidebar while it loads. */
export function buildNavigation(enabledModules: string[] | undefined, terminology?: Record<string, string>): NavigationSection[] {
  const itemsLabel = terminology?.items_label;
  const itemsHasOwnSection = enabledModules !== undefined && GENERIC_ITEMS_HOME_MODULES.some((m) => enabledModules.includes(m));
  const sections = ALL_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => !item.module || enabledModules === undefined || enabledModules.includes(item.module))
      .filter((item) => !(item.id === "items" && section.id === "setup" && itemsHasOwnSection))
      .map((item) => (item.id === "items" && itemsLabel ? { ...item, label: itemsLabel } : item)),
  })).filter((section) => section.items.length > 0);

  // Promote the active profile's own dedicated section (if it has one)
  // to the very top, right after the global items -- "this is YOUR
  // business" ahead of People & Payroll / Operations / Setup, which
  // exist for every business regardless of industry.
  const primaryModule = enabledModules?.find((m) => PRIMARY_SECTION_BY_MODULE[m]);
  const primarySectionId = primaryModule ? PRIMARY_SECTION_BY_MODULE[primaryModule] : undefined;
  if (primarySectionId) {
    const primaryIndex = sections.findIndex((s) => s.id === primarySectionId);
    if (primaryIndex > 0) {
      const [primarySection] = sections.splice(primaryIndex, 1);
      sections.unshift(primarySection);
    }
  }

  return sections;
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
