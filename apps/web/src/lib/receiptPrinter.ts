/** ADR-016: a real adapter *interface* for receipt printing, same
 * reasoning as AttendanceDeviceProvider (ADR-015) and the desktop
 * app's barcode-scanner note (ADR-012) -- there is no thermal printer
 * connected in this environment to write and verify raw ESC/POS/
 * WebUSB/WebBluetooth code against, and uncompiled, unverified
 * low-level device code is a bigger risk than an honest gap.
 *
 * `BrowserPrintProvider` is the one real, verified implementation:
 * `window.print()` to whatever printer the OS has configured. This is
 * not a lesser fallback -- it's how the overwhelming majority of real
 * thermal receipt printers actually integrate with web apps in
 * production, because they install as an ordinary OS/CUPS printer
 * over USB or network (exactly like the desktop app's A4 printing,
 * ADR-012) and the browser/webview print dialog already lets the
 * user pick 58mm/80mm paper size and copy count. "Download as PDF" is
 * the same window.print() call -- the user picks "Save as PDF" as
 * their destination in that same OS dialog, rather than a second,
 * server-side PDF-generation dependency this app doesn't otherwise
 * need.
 *
 * A future raw-ESC/POS or WebUSB/WebBluetooth provider implements the
 * same interface and is selected by `getReceiptPrinterProvider()` --
 * the print flow (PrintReceiptOverlay) is not coupled to how the
 * bytes actually reach the printer.
 */

export interface ReceiptPrinterProvider {
  print(options: { copies: number }): Promise<void>;
}

export class BrowserPrintProvider implements ReceiptPrinterProvider {
  async print(): Promise<void> {
    window.print();
  }
}

export function getReceiptPrinterProvider(): ReceiptPrinterProvider {
  return new BrowserPrintProvider();
}
