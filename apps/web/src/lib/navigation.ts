import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  Building,
  Building2,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UploadCloud,
  Users,
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
   * role gate can filter NAVIGATION_CONFIG later without touching every
   * sidebar variant that renders it. */
  permission?: string;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

/** Single source of truth for the sidebar -- desktop, collapsed desktop,
 * and the mobile drawer all render from this, so a new module is one
 * entry here rather than three hardcoded lists to keep in sync. */
export const NAVIGATION_CONFIG: NavigationSection[] = [
  {
    id: "sell",
    label: "Sell",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
      { id: "quotations", label: "Quotations", href: "/quotations", icon: FileText },
      { id: "collections", label: "Collections", href: "/collections", icon: Banknote },
      { id: "field-sales", label: "Field sales", href: "/field-sales", icon: MapPin },
      { id: "approvals", label: "Approvals", href: "/approvals", icon: ShieldCheck },
    ],
  },
  {
    id: "dispatch",
    label: "Dispatch",
    items: [
      { id: "dispatch-board", label: "Dispatch board", href: "/dispatch-board", icon: Truck },
      { id: "trips", label: "Trips", href: "/trips", icon: Truck },
      { id: "fleet", label: "Fleet", href: "/fleet", icon: Truck },
      { id: "stock-counts", label: "Stock counts", href: "/stock-counts", icon: ClipboardList },
      { id: "transfers", label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
    ],
  },
  {
    id: "buy",
    label: "Buy",
    items: [
      { id: "purchase-orders", label: "Purchase orders", href: "/purchase-orders", icon: ShoppingCart },
      { id: "suppliers", label: "Suppliers", href: "/suppliers", icon: Factory },
    ],
  },
  {
    id: "books",
    label: "Books",
    items: [
      { id: "financial-reports", label: "Financial reports", href: "/books", icon: FileSpreadsheet },
      { id: "gst", label: "GST filing", href: "/gst", icon: Receipt },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      { id: "items", label: "Items", href: "/items", icon: Package },
      { id: "customers", label: "Customers", href: "/customers", icon: Users },
      { id: "projects", label: "Projects", href: "/projects", icon: Building },
      { id: "imports", label: "Import from Tally/Busy", href: "/imports", icon: UploadCloud },
      { id: "branches", label: "Branches", href: "/branches", icon: Building2 },
      { id: "users", label: "Users", href: "/users", icon: Users },
      { id: "company-settings", label: "Company settings", href: "/company-settings", icon: Settings },
    ],
  },
];

/** Mirrors react-router's own NavLink matching so "which section owns the
 * active route" agrees with which link NavLink actually highlights. */
export function isItemActive(pathname: string, item: NavigationItem): boolean {
  if (item.end) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findActiveSectionId(pathname: string): string | undefined {
  return NAVIGATION_CONFIG.find((section) => section.items.some((item) => isItemActive(pathname, item)))?.id;
}
