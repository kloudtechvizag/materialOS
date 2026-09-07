import type { CategoryLite } from "@/lib/items";
import { groupItemsByCategory } from "@/lib/items";
import { cn } from "@/lib/utils";

const DEFAULT_CLASS = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Every item picker in the app (quotations, purchase orders, transfers,
 * ...) renders from this so "grouped by category" is one implementation,
 * not one per screen. Plain <select>/<optgroup> -- no new UI dependency,
 * keeps the exact interaction every other dropdown here already has. */
export function ItemSelect<T extends { id: string; name: string; category_id?: string | null }>({
  items,
  categories,
  value,
  onChange,
  placeholder = "Select item",
  className,
  id,
}: {
  items: T[] | undefined;
  categories: CategoryLite[] | undefined;
  value: string;
  onChange: (itemId: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const groups = groupItemsByCategory(items, categories);

  return (
    <select id={id} className={cn(DEFAULT_CLASS, className)} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
