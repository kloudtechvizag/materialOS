import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  Building,
  BookOpen,
  Bus,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  Coins,
  ClipboardCheck,
  Cpu,
  CreditCard,
  Database,
  Factory,
  FileCheck2,
  FileMinus,
  FilePenLine,
  FlaskConical,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  Inbox,
  IndianRupee,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPin,
  Megaphone,
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
    id: "inventory-trading",
    label: "Inventory & Trading",
    items: [
      // Items/Customers/Branches: relocated here from Setup (never
      // administrative config -- see OPERATIONAL_ENTITY_IDS). Only one
      // domain section ever keeps its copy of these three per profile
      // (buildNavigation resolves the one "entity home" section before
      // filtering), so a profile with more than one domain module
      // enabled (e.g. building_materials has both "warehouse" and
      // "projects") never shows them twice.
      { id: "items", label: "Items", href: "/items", icon: Package, module: "warehouse" },
      { id: "customers", label: "Customers", href: "/customers", icon: Users, module: "warehouse" },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2, module: "warehouse" },
      { id: "warehouses", label: "Warehouses", href: "/warehouses", icon: Warehouse, module: "warehouse" },
      { id: "batches", label: "Batches", href: "/batches", icon: Layers, module: "warehouse" },
      { id: "stock-ledger", label: "Stock movements", href: "/stock-ledger", icon: ArrowLeftRight, module: "warehouse" },
    ],
  },
  {
    id: "sales-dispatch",
    label: "Sales & Dispatch",
    items: [
      // Fallback home for Items/Customers/Branches: every profile
      // without its own dedicated domain section (retail, pharmacy,
      // jewellery, garments, ...) still needs *somewhere* for these
      // three to live now that Setup is off-limits to them -- this is
      // "the core domain block immediately following Approvals" for
      // those profiles. No module gate (unlike every other item here)
      // since these three aren't sales-specific; buildNavigation drops
      // this copy whenever the active profile has its own domain
      // section instead (laboratory/printing/inventory-trading/
      // projects-services), so they never show twice.
      { id: "items", label: "Items", href: "/items", icon: Package },
      { id: "customers", label: "Customers", href: "/customers", icon: Users },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2 },
      { id: "leads", label: "Leads", href: "/leads", icon: Target, permission: "leads.view", module: "sales" },
      { id: "pos", label: "POS", href: "/pos", icon: CreditCard, module: "pos" },
      { id: "quotations", label: "Quotations", href: "/quotations", icon: FileText, module: "sales" },
      { id: "sales-orders", label: "Sales orders", href: "/sales-orders", icon: ClipboardList, module: "sales" },
      { id: "collections", label: "Collections", href: "/collections", icon: Banknote, module: "collections" },
      { id: "field-sales", label: "Field sales", href: "/field-sales", icon: MapPin, module: "field_sales" },
      { id: "dispatch-board", label: "Dispatch board", href: "/dispatch-board", icon: Truck, module: "dispatch" },
      { id: "trips", label: "Trips", href: "/trips", icon: Truck, module: "fleet" },
      { id: "fleet", label: "Fleet", href: "/fleet", icon: Truck, module: "fleet" },
      { id: "stock-counts", label: "Stock counts", href: "/stock-counts", icon: ClipboardList, module: "inventory" },
      { id: "transfers", label: "Transfers", href: "/transfers", icon: ArrowLeftRight, module: "inventory" },
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
      // config. Customers/Branches moved here for the same reason --
      // printing_press has no "sales" module (see PROFILE_DEFINITIONS),
      // so the Sales & Dispatch fallback section doesn't even exist for
      // it; this is its only real home for these three.
      { id: "items", label: "Items", href: "/items", icon: Package, module: "printing" },
      { id: "customers", label: "Customers", href: "/customers", icon: Users, module: "printing" },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2, module: "printing" },
    ],
  },
  {
    id: "buy",
    label: "Procurement & Buying",
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
    id: "projects-services",
    label: "Projects & Services",
    items: [
      { id: "projects", label: "Projects", href: "/projects", icon: Building, module: "projects" },
      { id: "items", label: "Items", href: "/items", icon: Package, module: "projects" },
      { id: "customers", label: "Customers", href: "/customers", icon: Users, module: "projects" },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2, module: "projects" },
    ],
  },
  {
    id: "admissions",
    label: "Admissions",
    items: [
      { id: "admission-enquiries", label: "Enquiries", href: "/admission-enquiries", icon: Inbox, module: "education" },
      { id: "admission-applications", label: "Applications", href: "/admission-applications", icon: ClipboardCheck, module: "education" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      { id: "announcements", label: "Announcements", href: "/announcements", icon: Megaphone, module: "education" },
    ],
  },
  {
    id: "students",
    label: "Students",
    items: [
      { id: "student-directory", label: "Student Directory", href: "/students", icon: GraduationCap, module: "education" },
      { id: "student-attendance", label: "Student Attendance", href: "/student-attendance", icon: CalendarCheck, module: "education" },
      { id: "timetable", label: "Timetable", href: "/timetable", icon: CalendarClock, module: "education" },
      { id: "examinations", label: "Examinations", href: "/examinations", icon: FileCheck2, module: "education" },
      { id: "homework", label: "Homework", href: "/homework", icon: FilePenLine, module: "education" },
      { id: "fees", label: "Fees", href: "/fees", icon: IndianRupee, module: "education" },
      { id: "transport", label: "Transport", href: "/transport", icon: Bus, module: "education" },
      { id: "library", label: "Library", href: "/library", icon: BookOpen, module: "education" },
      { id: "school-classes", label: "Classes & Sections", href: "/classes", icon: KanbanSquare, module: "education" },
      { id: "academic-years", label: "Academic Years", href: "/academic-years", icon: CalendarDays, module: "education" },
      // Multi-campus (spec's own "School Groups", Phase 7) isn't built
      // yet -- a single-school tenant still has exactly one real
      // Branch from signup and needs somewhere to manage it, same
      // reasoning as inventory-trading/projects-services's own copies.
      { id: "branches", label: "Branches", href: "/branches", icon: Building2, module: "education" },
    ],
  },
  {
    id: "books",
    label: "Finance & Books",
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
      // Customers/Branches moved here for the same reason -- laboratory
      // has no "sales" module (see PROFILE_DEFINITIONS), so the Sales &
      // Dispatch fallback section doesn't even exist for it; this is
      // its only real home for these three.
      { id: "items", label: "Items", href: "/items", icon: Package, module: "laboratory" },
      { id: "customers", label: "Customers", href: "/customers", icon: Users, module: "laboratory" },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2, module: "laboratory" },
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
    // Strictly system-level configuration from here down -- no
    // transactional/operational entity (Items, Customers, Branches,
    // Projects) belongs in this section; each has a real home in the
    // active profile's own domain section instead (see
    // OPERATIONAL_ENTITY_IDS and the "projects-services"/"inventory-
    // trading"/"laboratory"/"printing" sections above, or the Sales &
    // Dispatch fallback for every other profile).
    items: [
      // A Tally/Busy accounting-software migration wizard (ImportBatch's
      // own docstring) -- meaningless without "accounting" (see Books).
      { id: "imports", label: "Import from Tally/Busy", href: "/imports", icon: UploadCloud, module: "accounting" },
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

/** For a profile with its own dedicated domain section (laboratory ->
 * "laboratory", printing -> "printing", "warehouse" -> "inventory-
 * trading", "projects" -> "projects-services"), that section is what
 * the tenant's business actually IS -- it belongs directly under the
 * two global items (Dashboard, Approvals), ahead of cross-cutting
 * sections like People & Payroll and Setup that exist for every
 * business regardless of industry. Every other profile (retail,
 * pharmacy, ...) has no single section that plays this role (Sales &
 * Dispatch/Procurement & Buying/Finance & Books together form its
 * primary workflow, not one section), so their relative order is left
 * exactly as ALL_NAV_SECTIONS declares it.
 *
 * Doubles as the answer to "which section owns Items/Customers/
 * Branches for this profile" (see OPERATIONAL_ENTITY_IDS below) --
 * `Array.prototype.find` picks the first matching key in the profile's
 * own `enabled_modules` order, so a profile enabling more than one of
 * these (building_materials has both "warehouse" and "projects")
 * deterministically picks one home rather than showing the same three
 * items twice. */
const PRIMARY_SECTION_BY_MODULE: Record<string, string> = {
  laboratory: "laboratory",
  printing: "printing",
  // Every profile that enables "warehouse" is a B2B distributor/trader
  // whose actual business IS moving stock through godowns (building
  // materials, FMCG, auto parts, chemicals, electrical, paper, paint,
  // ecommerce -- see PROFILE_DEFINITIONS) -- Inventory & Trading is
  // their real primary domain, the same way Laboratory/Printing are for
  // theirs. Profiles without "warehouse" (retail, pharmacy, grocery,
  // ...) keep the generic Sales & Dispatch-first order: their own
  // storefront/counter is the primary interaction, not warehouse ops.
  warehouse: "inventory-trading",
  // Furniture and Real Estate are the only two profiles where
  // "projects" is enabled without "warehouse" also winning first (see
  // PROFILE_DEFINITIONS) -- for them, project-based work genuinely IS
  // the primary domain.
  projects: "projects-services",
  // School Management's entire reason for existing is the student
  // lifecycle (ADR's own "connected student lifecycle" principle) --
  // never shares enabled_modules with warehouse/projects, so no
  // ordering conflict is possible.
  education: "students",
};

/** Items, Customers, and Branches are real business entities, never
 * administrative config -- this project's own architectural rule is
 * that none of the three may live under Setup for any profile. Each
 * lives in exactly one place: the active profile's own primary domain
 * section (PRIMARY_SECTION_BY_MODULE) if it has one, else the generic
 * Sales & Dispatch section, which every profile without a dedicated
 * domain already leads with (see buildNavigation's entityHomeSectionId). */
const OPERATIONAL_ENTITY_IDS = ["items", "customers", "branches"];

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

  // Resolved once, up front, so the per-item filter below can use it:
  // whichever section this profile's own primary domain module maps to
  // (or the generic Sales & Dispatch fallback, for the profiles with no
  // dedicated domain) is the ONE place Items/Customers/Branches survive
  // filtering -- every other section's own copy of them (there's one in
  // each domain section, module-gated) gets dropped, even if that
  // section's own module happens to also be enabled (see
  // PRIMARY_SECTION_BY_MODULE's docstring).
  const primaryModule = enabledModules?.find((m) => PRIMARY_SECTION_BY_MODULE[m]);
  const primarySectionId = primaryModule ? PRIMARY_SECTION_BY_MODULE[primaryModule] : undefined;
  const entityHomeSectionId = primarySectionId ?? "sales-dispatch";

  const sections = ALL_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => !item.module || enabledModules === undefined || enabledModules.includes(item.module))
      .filter((item) => !(OPERATIONAL_ENTITY_IDS.includes(item.id) && section.id !== entityHomeSectionId))
      .map((item) => (item.id === "items" && itemsLabel ? { ...item, label: itemsLabel } : item)),
  })).filter((section) => section.items.length > 0);

  // Promote the active profile's own dedicated section (if it has one)
  // to the very top, right after the global items -- "this is YOUR
  // business" ahead of People & Payroll / Operations / Setup, which
  // exist for every business regardless of industry.
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
