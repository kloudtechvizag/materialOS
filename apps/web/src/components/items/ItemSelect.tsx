import { useState } from "react";

import { QuickAddItemModal } from "@/components/entities/QuickAddItemModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
import type { CategoryLite } from "@/lib/items";
import { groupItemsByCategory } from "@/lib/items";

/** Every item picker in the app (quotations, purchase orders, transfers,
 * ...) renders from this so "grouped by category, searchable, with a
 * quick-add" is one implementation, not one per screen. */
export function ItemSelect<T extends { id: string; name: string; category_id?: string | null; sku?: string }>({
  items,
  categories,
  value,
  onChange,
  placeholder = "Select item",
  className,
}: {
  items: T[] | undefined;
  categories: CategoryLite[] | undefined;
  value: string;
  onChange: (itemId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const groups = groupItemsByCategory(items, categories);

  const options = groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.name,
      sublabel: item.sku,
      group: group.label,
    }))
  );

  return (
    <>
      <SearchableSelect
        className={className}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder="Search items..."
        emptyText="No items match."
        quickAddLabel="Quick Add Item"
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <QuickAddItemModal open={quickAddOpen} onOpenChange={setQuickAddOpen} onCreated={(item) => onChange(item.id)} />
    </>
  );
}
