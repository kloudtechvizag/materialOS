import React, { useState } from "react";
import { LayoutGrid, Table as TableIcon, ChevronRight } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
  isPrimary?: boolean;
  priority?: "high" | "medium" | "low"; // high = always visible, medium = tablet+, low = desktop only
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  emptyState?: React.ReactNode;
  onRowClick?: (item: T) => void;
  title?: string;
  defaultView?: "table" | "cards";
  showViewToggle?: boolean;
  className?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  onRowClick,
  title,
  defaultView,
  showViewToggle = true,
  className,
}: ResponsiveTableProps<T>) {
  const { isMobile } = useBreakpoint();
  const [viewMode, setViewMode] = useState<"table" | "cards">(
    defaultView || (isMobile ? "cards" : "table")
  );

  const primaryCol = columns.find((c) => c.isPrimary) || columns[0];
  const secondaryCols = columns.filter((c) => c !== primaryCol);

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const isCards = viewMode === "cards";

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* View Switcher Header (Visible on Mobile & Tablet) */}
      {(title || (showViewToggle && isMobile)) && (
        <div className="flex items-center justify-between gap-2 px-1">
          {title ? (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          ) : (
            <div />
          )}

          {showViewToggle && (
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <Button
                variant={!isCards ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant={isCards ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setViewMode("cards")}
                aria-label="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Card View (Mobile-First Card Layout) */}
      {isCards ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
          {data.map((item, idx) => {
            const key = keyExtractor(item, idx);
            const primaryValue = primaryCol.cell
              ? primaryCol.cell(item)
              : primaryCol.accessorKey
              ? String(item[primaryCol.accessorKey] ?? "")
              : null;

            return (
              <div
                key={key}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all",
                  onRowClick && "cursor-pointer hover:border-primary/50 active:scale-[0.99]"
                )}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {primaryCol.header}
                    </span>
                    <div className="truncate text-sm font-semibold text-foreground">
                      {primaryValue}
                    </div>
                  </div>
                  {onRowClick && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                  )}
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                  {secondaryCols.map((col, cIdx) => {
                    const val = col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? String(item[col.accessorKey] ?? "")
                      : null;

                    return (
                      <div key={cIdx} className="min-w-0">
                        <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                          {col.header}
                        </span>
                        <div className="truncate font-medium text-foreground">
                          {val ?? "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Standard Table View (with horizontal scroll indicators and column priorities) */}
      <div
        className={cn(
          "relative w-full rounded-xl border border-border bg-card shadow-xs",
          isCards ? "hidden lg:block" : "block"
        )}
      >
        <div className="responsive-table-scroll">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-4 py-3 whitespace-nowrap",
                      col.priority === "low" && "hidden xl:table-cell",
                      col.priority === "medium" && "hidden md:table-cell",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item, rowIdx) => (
                <tr
                  key={keyExtractor(item, rowIdx)}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((col, colIdx) => {
                    const content = col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? String(item[col.accessorKey] ?? "")
                      : null;

                    return (
                      <td
                        key={colIdx}
                        className={cn(
                          "px-4 py-3",
                          col.isPrimary && "font-medium text-foreground",
                          col.priority === "low" && "hidden xl:table-cell",
                          col.priority === "medium" && "hidden md:table-cell",
                          col.className
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ResponsiveTable;
