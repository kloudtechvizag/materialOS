export interface CategoryLite {
  id: string;
  name: string;
}

export interface ItemGroup<T> {
  id: string;
  label: string;
  items: T[];
}

const UNCATEGORIZED_ID = "__uncategorized__";

/** Groups items by category for any item picker (quotations, purchase
 * orders, transfers, stock counts, ...) so category is one concept
 * defined once, not re-implemented per screen. Uncategorized items sort
 * last so a fully-categorized catalog doesn't push real categories down. */
export function groupItemsByCategory<T extends { category_id?: string | null }>(
  items: T[] | undefined,
  categories: CategoryLite[] | undefined
): ItemGroup<T>[] {
  if (!items || items.length === 0) return [];

  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const groups = new Map<string, ItemGroup<T>>();

  for (const item of items) {
    const id = item.category_id ?? UNCATEGORIZED_ID;
    const label = item.category_id ? categoryNames.get(item.category_id) ?? "Other" : "Uncategorized";
    if (!groups.has(id)) groups.set(id, { id, label, items: [] });
    groups.get(id)!.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.id === UNCATEGORIZED_ID) return 1;
    if (b.id === UNCATEGORIZED_ID) return -1;
    return a.label.localeCompare(b.label);
  });
}
