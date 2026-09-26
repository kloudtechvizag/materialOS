import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "@/lib/api";
import { useIndustryProfile } from "@/lib/industryProfile";
import { useCommandPaletteStore } from "@/store/commandPalette";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

interface SearchResults {
  customers: SearchResultItem[];
  suppliers: SearchResultItem[];
  items: SearchResultItem[];
  quotations: SearchResultItem[];
  sales_orders: SearchResultItem[];
  invoices: SearchResultItem[];
  purchase_orders: SearchResultItem[];
}

const GROUPS: { key: keyof SearchResults; label: string; icon: typeof Building2 }[] = [
  { key: "customers", label: "Customers", icon: Building2 },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "items", label: "Items", icon: Package },
  { key: "quotations", label: "Quotations", icon: FileText },
  { key: "sales_orders", label: "Sales orders", icon: FileText },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "purchase_orders", label: "Purchase orders", icon: ShoppingCart },
];

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Plus;
  module?: string;
  keywords: string[];
}

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();
  const { profile } = useIndustryProfile();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const enabledModules = profile?.enabled_modules;
  const itemLabel = profile?.terminology?.item_label ?? "Item";

  const allQuickActions: QuickAction[] = useMemo(() => [
    {
      id: "qa-quote",
      title: "New Quotation",
      subtitle: "Draft a sales quote with real-time stock check",
      href: "/quotations/new",
      icon: Plus,
      module: "sales",
      keywords: ["quotation", "quote", "create", "new", "estimate", "deal"],
    },
    {
      id: "qa-customer",
      title: "Add Customer",
      subtitle: "Create customer with credit limits and GSTIN",
      href: "/customers?new=1",
      icon: Users,
      keywords: ["customer", "client", "add", "new", "buyer", "account"],
    },
    {
      id: "qa-item",
      title: `Add ${itemLabel}`,
      subtitle: `Catalog a new ${itemLabel.toLowerCase()} with SKU and pricing`,
      href: "/items?new=1",
      icon: Package,
      keywords: ["item", "product", "sku", "add", "new", "catalog", "material", "medicine"],
    },
    {
      id: "qa-po",
      title: "New Purchase Order",
      subtitle: "Order supplies or stock from vendor",
      href: "/purchase-orders",
      icon: ShoppingCart,
      module: "purchase",
      keywords: ["po", "purchase", "order", "supplier", "vendor", "buy"],
    },
    {
      id: "qa-batch",
      title: "Create Batch / Lot",
      subtitle: "Register lot code, expiry, and heat number",
      href: "/batches",
      icon: Layers,
      module: "warehouse",
      keywords: ["batch", "lot", "expiry", "heat", "track", "warehouse"],
    },
    {
      id: "qa-transfer",
      title: "Stock Transfer",
      subtitle: "Move inventory between godowns/warehouses",
      href: "/transfers",
      icon: ArrowRight,
      module: "warehouse",
      keywords: ["transfer", "stock", "godown", "warehouse", "movement", "move"],
    },
    {
      id: "qa-payment",
      title: "Collect Payment",
      subtitle: "Record customer receipt and reconcile ledger",
      href: "/collections",
      icon: Wallet,
      module: "collections",
      keywords: ["payment", "receipt", "collect", "money", "cheque", "upi"],
    },
    {
      id: "qa-approvals",
      title: "View Pending Approvals",
      subtitle: "Review urgent credit limits and discounts",
      href: "/approvals",
      icon: ShieldCheck,
      keywords: ["approval", "pending", "urgent", "request", "review"],
    },
    {
      id: "qa-low-stock",
      title: "View Low Stock Alerts",
      subtitle: "Items currently below configured reorder point",
      href: "/items",
      icon: AlertTriangle,
      keywords: ["low stock", "stock", "reorder", "inventory", "alert", "shortage"],
    },
    // Industry specific
    {
      id: "qa-lab-sample",
      title: "Register Laboratory Sample",
      subtitle: "Accession test sample with matrix and chain of custody",
      href: "/lab/samples",
      icon: FlaskConical,
      module: "laboratory",
      keywords: ["sample", "lab", "test", "register", "lims", "accession"],
    },
    {
      id: "qa-student",
      title: "Add Student Record",
      subtitle: "Enrol student with guardian and academic details",
      href: "/students?new=1",
      icon: GraduationCap,
      module: "education",
      keywords: ["student", "school", "enrol", "admission", "pupil", "child"],
    },
    {
      id: "qa-print-job",
      title: "New Print Job",
      subtitle: "Schedule print order with artwork and machine allocation",
      href: "/print-jobs",
      icon: Printer,
      module: "printing",
      keywords: ["print", "job", "artwork", "press", "production"],
    },
  ], [itemLabel]);

  const filteredQuickActions = useMemo(() => {
    const q = debounced.toLowerCase();
    return allQuickActions.filter((act) => {
      if (act.module && enabledModules && !enabledModules.includes(act.module)) {
        return false;
      }
      if (!q) return true;
      return (
        act.title.toLowerCase().includes(q) ||
        act.subtitle.toLowerCase().includes(q) ||
        act.keywords.some((k) => k.includes(q))
      );
    });
  }, [allQuickActions, enabledModules, debounced]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => apiFetch<SearchResults>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0,
  });

  const groupsWithResults = useMemo(
    () => GROUPS.map((g) => ({ ...g, results: data?.[g.key] ?? [] })).filter((g) => g.results.length > 0),
    [data]
  );
  const hasAnyResults = groupsWithResults.length > 0;

  function goTo(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Command Palette & Global Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4 bg-muted/20">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type an action (e.g. 'New Quotation') or search records..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground sm:block">
              Esc
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {/* Quick Actions section */}
            {filteredQuickActions.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Business Actions</span>
                </div>
                <div className="grid gap-0.5">
                  {filteredQuickActions.slice(0, debounced ? 4 : 6).map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => goTo(action.href)}
                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary">
                          <ActionIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground group-hover:text-primary leading-tight">
                            {action.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate leading-tight">
                            {action.subtitle}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 text-primary transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {debounced.length > 0 && isFetching && !data && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching records...</p>
            )}

            {debounced.length > 0 && data && !hasAnyResults && filteredQuickActions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No commands or records found for "{debounced}".
              </p>
            )}

            {/* Entity Search Results */}
            {groupsWithResults.map((group) => (
              <div key={group.key} className="mb-2 border-t border-border/40 pt-2">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goTo(r.href)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <group.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                    {r.subtitle && (
                      <span className="shrink-0 truncate text-xs text-muted-foreground">
                        {r.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
