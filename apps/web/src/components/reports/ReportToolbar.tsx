import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shared header for every financial-statement view (Trial Balance, P&L,
 * Balance Sheet, Cash Flow) -- one toolbar so a date-range control and
 * print/export always look and behave the same way across reports. */
export function ReportToolbar({
  dateLabel,
  children,
  onDownload,
  onPrint,
}: {
  /** e.g. "AT THE END OF" or "FOR THE PERIOD" -- small caption above the date control(s). */
  dateLabel: string;
  /** The actual date input(s). */
  children: ReactNode;
  onDownload?: () => void;
  onPrint?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 print:hidden">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{dateLabel}</p>
        <div className="mt-1 flex items-center gap-2">{children}</div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Print" onClick={onPrint ?? (() => window.print())}>
          <Printer className="h-4 w-4" />
        </Button>
        {onDownload && (
          <Button variant="outline" size="icon" aria-label="Download CSV" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
