import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  FileText,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
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

/** Ctrl+K / Cmd+K global search across the entities the app already
 * exposes real list/detail pages for -- backed by GET /search, which
 * only returns a category if the caller actually has that resource's
 * view permission (see api/v1/search.py). Mounted once in AppShell. */
export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, suppliers, items, invoices..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:block">Esc</kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {debounced.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Start typing to search across the app.</p>
            )}
            {debounced.length > 0 && isFetching && !data && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching...</p>
            )}
            {debounced.length > 0 && data && !hasAnyResults && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for "{debounced}".</p>
            )}
            {groupsWithResults.map((group) => (
              <div key={group.key} className="mb-1">
                <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                {group.results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goTo(r.href)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <group.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.subtitle && <span className="shrink-0 truncate text-xs text-muted-foreground">{r.subtitle}</span>}
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
