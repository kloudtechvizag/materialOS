import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  id: string;
  label: string;
  /** Small muted detail shown next to the label, e.g. a phone number or SKU. */
  sublabel?: string;
  /** Optional group header (e.g. category name) -- options are shown under
   * the header for the group they belong to, in first-seen order. */
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[] | undefined;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Label for the pinned "+ Quick Add" row, e.g. "Quick Add Customer".
   * Omit onQuickAdd to render this select with no quick-add action at all. */
  quickAddLabel?: string;
  onQuickAdd?: () => void;
}

/** Generic searchable combobox used everywhere a plain <select> used to
 * pick an existing record (customer, project, site, supplier, item, ...).
 * A single implementation so search behavior and the "+ Quick Add" row
 * are consistent across every transaction form instead of reinvented per
 * screen -- see NewQuotationPage / PurchaseOrdersPage for usage. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled,
  className,
  quickAddLabel,
  onQuickAdd,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options?.find((o) => o.id === value);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (options ?? []).filter(
      (o) => !q || o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q)
    );
    const order: string[] = [];
    const byGroup = new Map<string, SearchableSelectOption[]>();
    for (const opt of filtered) {
      const key = opt.group ?? "";
      if (!byGroup.has(key)) {
        byGroup.set(key, []);
        order.push(key);
      }
      byGroup.get(key)!.push(opt);
    }
    return order.map((key) => ({ label: key, items: byGroup.get(key)! }));
  }, [options, query]);

  const hasResults = groups.some((g) => g.items.length > 0);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-60 overflow-y-auto p-1">
          {!hasResults && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>}
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.label || "__default__"}>
                  {group.label && (
                    <p className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  )}
                  {group.items.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => select(opt.id)}
                      className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <Check className={cn("h-4 w-4 shrink-0", opt.id === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {opt.sublabel && <span className="shrink-0 truncate text-xs text-muted-foreground">{opt.sublabel}</span>}
                    </button>
                  ))}
                </div>
              )
          )}
        </div>

        {onQuickAdd && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
                onQuickAdd();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              {quickAddLabel ?? "Quick Add"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
