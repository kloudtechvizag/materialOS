import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getReceiptPrinterProvider } from "@/lib/receiptPrinter";
import { type ReceiptDocumentType, useReceiptData } from "@/lib/receipts";
import { ReceiptRenderer } from "@/components/receipts/ReceiptRenderer";

interface PrintReceiptOverlayProps {
  documentType: ReceiptDocumentType;
  documentId: string;
  onClose: () => void;
}

const PAPER_WIDTHS = [
  { label: "58mm", value: 58 },
  { label: "80mm", value: 80 },
];

/** Complete Sale -> Payment -> Receipt Preview -> Print/Reprint/Download
 * (spec's own flow). A self-contained overlay rather than a route --
 * navigating away from an active POS screen to print would lose the
 * cart-cleared/next-sale state PosPage already manages. Print CSS
 * (@page sizing per paper width, [data-print-area] isolation) mirrors
 * InvoiceDetailPage's existing print mechanism (ADR-012) exactly, so
 * both go through the same window.print() -> OS print dialog path. */
export function PrintReceiptOverlay({ documentType, documentId, onClose }: PrintReceiptOverlayProps) {
  const { data, isLoading, error, refetch } = useReceiptData(documentType, documentId);
  const [paperWidth, setPaperWidth] = useState<number>(80);
  const [customWidth, setCustomWidth] = useState<string>("");
  const [copies, setCopies] = useState(1);
  const [hasPrinted, setHasPrinted] = useState(false);

  useEffect(() => {
    if (data) setPaperWidth(data.settings.default_paper_width_mm);
  }, [data]);

  // @page size must be a static CSS value known to the print engine at
  // print time -- injected here rather than baked into index.css since
  // it depends on the user's paper-width choice.
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "receipt-page-size";
    style.textContent = `@media print { @page { size: ${paperWidth}mm auto; margin: 0; } }`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [paperWidth]);

  async function handlePrint() {
    // window.print() has no "copies" argument of its own -- looping it
    // would pop up `copies` separate OS print dialogs, which is worse
    // UX than the one real copies control every OS print dialog already
    // has. The copies input here is a heads-up, not a second mechanism.
    await getReceiptPrinterProvider().print({ copies });
    setHasPrinted(true);
  }

  const effectiveWidth = customWidth ? Number(customWidth) || paperWidth : paperWidth;

  return (
    // Deliberately NOT marked .no-print on this or any ancestor of the
    // [data-print-area] div below: index.css's print rule hides
    // everything via `visibility: hidden` (which a `visibility: visible`
    // descendant can still override) but `.no-print`'s `display: none`
    // cannot be overridden by any descendant -- putting it here would
    // silently remove the receipt from the printed page entirely. Only
    // the header and the controls column (genuinely UI-only) get it.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-background shadow-xl">
        <div className="no-print flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Print receipt</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row">
          <div className="no-print flex-1 space-y-4">
            <div>
              <label className="text-sm font-medium">Paper width</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PAPER_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => { setPaperWidth(w.value); setCustomWidth(""); }}
                    className={`rounded-md border px-3 py-1.5 text-sm ${paperWidth === w.value && !customWidth ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                  >
                    {w.label}
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom (mm)"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Copies</label>
              <input
                type="number"
                min={1}
                max={10}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1.5 h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Set to {copies} in the print dialog that opens.</p>
            </div>

            {isLoading && <Skeleton className="h-40" />}
            {error && <ErrorState error={error} onRetry={() => refetch()} />}

            {data && (
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handlePrint} disabled={isLoading}>
                  <Printer className="h-4 w-4" /> {hasPrinted ? "Reprint" : "Print"}
                </Button>
                <Button variant="outline" onClick={handlePrint} disabled={isLoading}>
                  Download as PDF
                </Button>
                <p className="text-xs text-muted-foreground">
                  &quot;Download as PDF&quot; opens the same print dialog -- choose &quot;Save as PDF&quot; as the destination.
                </p>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
              </div>
            )}
          </div>

          <div className="flex justify-center overflow-auto rounded-md border border-dashed border-border bg-muted/30 p-4">
            {data && (
              <div data-print-area>
                <ReceiptRenderer data={data} paperWidthMm={effectiveWidth} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
