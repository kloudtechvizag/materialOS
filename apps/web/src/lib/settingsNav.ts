import type { LucideIcon } from "lucide-react";
import { Building2, Coins, CreditCard, Printer, SlidersHorizontal, Store, UploadCloud, Users, Webhook } from "lucide-react";

export interface SettingsItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  module?: string;
  permission?: string;
}

export interface SettingsCategory {
  id: string;
  label: string;
  items: SettingsItem[];
}

/** ADR-048: the single settings workspace's own secondary nav -- every
 * item here reuses an existing, already-shipped page (see App.tsx's
 * `/settings/*` routes); this file only decides grouping and
 * visibility, never a second settings implementation.
 *
 * Deliberately NO "Platform Administration" category: real platform-
 * wide administration (managing OTHER tenants, global plans, platform
 * admins) already lives at `/platform/*`, behind a completely separate
 * `PlatformAdmin` login this tenant-facing shell never touches -- it
 * isn't a tab an ordinary tenant user could stumble into even with a
 * permission check, because no tenant User is ever also a
 * PlatformAdmin. What ADR-047 had called "Platform Administration"
 * (Industry/Subscription/Capabilities/Webhooks/Support) was actually
 * always this tenant's own relationship with the MaterialOS platform,
 * not platform administration -- relabeled and regrouped here into
 * Business/Subscription/Integrations, matching what each item really
 * is. Support moved to the global header (AppShell) per the master
 * prompt's own "globally accessible... not duplicated as a Settings
 * category" instruction. */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    // "Configuration specific to the active business profile" -- today
    // that's real for exactly one thing (which industry profile this
    // org runs as, and its resulting terminology/enabled modules); a
    // school-specific Academic/Admission/Fee "configuration" screen
    // doesn't exist as separate master data yet (see ADR-046/ADR-047's
    // own "deliberately not built" notes) -- those stay reachable from
    // their own real operational sections (Academics, Finance, ...),
    // not duplicated into a second Settings-side copy.
    id: "business",
    label: "Business Settings",
    items: [
      { id: "industry", label: "Industry Profile", href: "/settings/business", icon: SlidersHorizontal, permission: "companies.view" },
    ],
  },
  {
    id: "organization",
    label: "Organization Settings",
    items: [
      { id: "users", label: "Users", href: "/settings/users", icon: Users, permission: "users.view" },
      { id: "company", label: "Company Settings", href: "/settings/company", icon: Building2, permission: "companies.view" },
    ],
  },
  {
    id: "billing",
    label: "Subscription & Billing",
    items: [
      { id: "subscription", label: "Subscription", href: "/settings/subscription", icon: CreditCard, permission: "subscription.view" },
      { id: "capabilities", label: "Capabilities", href: "/settings/capabilities", icon: Store, permission: "subscription.view" },
    ],
  },
  {
    id: "system",
    label: "Integrations & System",
    items: [
      { id: "webhooks", label: "Webhooks", href: "/settings/webhooks", icon: Webhook, permission: "webhooks.view" },
      // Meaningless without "accounting" (payment-receipt template /
      // Tally-Busy migration are both accounting-stack concepts).
      { id: "receipts", label: "Receipts", href: "/settings/receipts", icon: Printer, permission: "receipts.manage", module: "accounting" },
      { id: "imports", label: "Import from Tally/Busy", href: "/settings/imports", icon: UploadCloud, module: "accounting" },
      // Jewellery-only: gold/silver rate entry (resolve_price()'s
      // jewellery branch, ADR-010's jewellery addendum).
      { id: "metal-rates", label: "Metal Rates", href: "/settings/metal-rates", icon: Coins, permission: "items.edit", module: "jewellery" },
    ],
  },
];

export function buildSettingsNav(enabledModules: string[] | undefined, permissions: string[] | undefined): SettingsCategory[] {
  return SETTINGS_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter(
      (item) =>
        (!item.module || enabledModules === undefined || enabledModules.includes(item.module)) &&
        (!item.permission || permissions === undefined || permissions.includes(item.permission))
    ),
  })).filter((category) => category.items.length > 0);
}
