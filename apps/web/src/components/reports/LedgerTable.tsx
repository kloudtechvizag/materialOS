import { formatINRPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LedgerRow {
  label: string;
  amount: string | number;
  /** Dashed-border callout for a computed/plug figure (e.g. profit for the period). */
  highlight?: boolean;
  bold?: boolean;
}

function Cell({ row }: { row: LedgerRow | undefined }) {
  if (!row) return null;
  const inner = (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("truncate", row.bold && "font-semibold")}>{row.label}</span>
      <span className={cn("shrink-0 tabular-nums", row.bold && "font-semibold")}>{formatINRPrecise(row.amount)}</span>
    </div>
  );
  if (row.highlight) {
    return <div className="rounded-md border border-dashed border-border px-2 py-1">{inner}</div>;
  }
  return inner;
}

/** Two side-by-side ledger columns sharing one row-number gutter -- the
 * classic accounting "T" layout (Balance Sheet: liabilities | assets;
 * P&L: income | expenses). Rows are paired positionally by index, same
 * as a physical ledger page, not because the two sides are related. */
export function TwoColumnLedger({
  leftTitle,
  rightTitle,
  leftRows,
  rightRows,
  leftTotal,
  rightTotal,
}: {
  leftTitle: string;
  rightTitle: string;
  leftRows: LedgerRow[];
  rightRows: LedgerRow[];
  leftTotal: string | number;
  rightTotal: string | number;
}) {
  const rowCount = Math.max(leftRows.length, rightRows.length);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="w-10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{leftTitle} (Rs.)</th>
            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rightTitle} (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 align-top text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 align-top">
                <Cell row={leftRows[i]} />
              </td>
              <td className="px-3 py-2 align-top">
                <Cell row={rightRows[i]} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/15 bg-muted/30">
            <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">Total</td>
            <td className="px-3 py-2 font-semibold">
              <div className="flex items-center justify-between gap-3">
                <span>Total</span>
                <span className="tabular-nums">{formatINRPrecise(leftTotal)}</span>
              </div>
            </td>
            <td className="px-3 py-2 font-semibold">
              <div className="flex items-center justify-between gap-3">
                <span>Total</span>
                <span className="tabular-nums">{formatINRPrecise(rightTotal)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** A single numbered ledger column -- Trial Balance and Cash Flow are
 * inherently one flat list, not a two-sided "T", so they get one column
 * instead of forcing a fake pairing. */
export function SingleColumnLedger({
  title,
  rows,
  total,
}: {
  title: string;
  rows: LedgerRow[];
  total?: string | number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="w-10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">#</th>
            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title} (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 align-top text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 align-top">
                <Cell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
        {total !== undefined && (
          <tfoot>
            <tr className="border-t-2 border-foreground/15 bg-muted/30">
              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground"></td>
              <td className="px-3 py-2 font-semibold">
                <div className="flex items-center justify-between gap-3">
                  <span>Total</span>
                  <span className="tabular-nums">{formatINRPrecise(total)}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
