# ADR-016: A configurable receipt template engine, not per-module printing

**Context:** the directive is explicit and repeated: "Do not hardcode
receipt layouts into individual modules. Create a reusable receipt-
rendering component" that works "across Web POS, Desktop POS, Mobile
POS" and every MaterialOS industry, with a real 58mm/80mm-accurate
print CSS, admin-configurable content, and support for the seven named
document kinds (retail receipt, GST invoice, POS receipt, payment
receipt, delivery receipt, credit note, estimate).

## Architecture: one data shape, one render component, six assemblers

**`ReceiptData`** (`schemas/receipts.py`) is the single normalized
shape every document type maps into: header (company/branch/GSTIN/
phone/email), customer block, line items, tax breakdown, payment
info, and the tenant's own `ReceiptSettings`. **`ReceiptRenderer`**
(`components/receipts/ReceiptRenderer.tsx`) is the *only* place a
receipt is laid out -- POS, invoices, quotations, delivery notes, and
credit notes all render through this same component fed by the same
`GET /receipts/{document_type}/{document_id}` shape. Adding a new
document type is a new `_from_x()` assembler function
(`services/receipt_templates.py`), never a new receipt component --
that's the whole point of "don't hardcode receipt layouts into
individual modules."

**Six assemblers cover the spec's seven named templates**, because two
of them (POS receipt, retail receipt) are the same underlying data --
`WalkInSale` is already a thin header around a real `Invoice`
(ADR-010's Slice E), so `_from_walk_in_sale()` just calls
`_from_invoice()` and adds the cash/UPI/card settlement info on top.
`document_type="invoice"` doubles as both "GST invoice" and "retail
receipt" -- the `show_gst_breakdown` setting controls whether the tax
lines actually render, not a second document type.

**Cashier/salesperson attribution reuses the audit trigger (ADR-013),
not a new column.** Neither `WalkInSale`, `Invoice`, nor `Receipt`
store who created them -- adding a redundant `created_by_user_id` to
three separate core Slice 1 tables just for this would duplicate what
the audit trigger (`audit_trigger_fn`, running since Slice 0) already
captures reliably on every INSERT. `_creator_name()` looks up the
INSERT row in `audit_log` and resolves `changed_by_user_id` to a name
-- the same "shared platform services" reuse this project has applied
repeatedly (People & Payroll's advance-deduction accounting, Billing's
notification triggers).

## Configurable, not per-module (`ReceiptSettings`)

One row per company (`models/receipts.py`): logo/customer-details/GST-
breakdown/SKU/cashier-name/UPI-QR toggles, footer message, terms &
conditions, return policy, social/contact info, and default paper
width. Every document type reads the *same* settings row -- a tenant
that turns off GST breakdown sees it off on POS receipts, invoices,
and everything else at once, not a setting duplicated per module.

**`Company.phone`/`Company.email` did not exist anywhere in the
schema before this** -- only a customer/supplier's own contact details
were modeled. A receipt header needs the business's own phone/email;
added as two nullable columns rather than working around the gap.

## Thermal accuracy (spec's own 58mm/80mm/custom, no whitespace requirement)

`ReceiptRenderer` renders at the physical width (`width: {mm}mm`,
monospace, high-contrast, no color) both on screen (the preview) and
on paper. `@page { size: {mm}mm auto; margin: 0 }` is injected as a
`<style>` tag at print time (`PrintReceiptOverlay`) rather than baked
into `index.css`, since it depends on the paper width the user picks
in that moment -- `@page size` needs a static value, not a CSS
variable, so this is the standard way production thermal-receipt web
integrations handle a runtime-chosen paper size. A real bug caught
before it ever shipped: the print-preview overlay's own
`[data-print-area]` was first nested inside a `.no-print` ancestor
(the modal chrome) -- `.no-print`'s `display: none` cannot be
overridden by a `visibility: visible` descendant the way
`index.css`'s own `body * { visibility: hidden }` rule can, so the
receipt would have silently never printed at all. A second bug caught
the same way while wiring the invoice page's own second print button:
with the overlay rendered as a sibling of the invoice page's existing
`[data-print-area]` (needed so printing the invoice's full A4 layout
and printing its thermal receipt don't nest), *both* elements would
simultaneously match the global print CSS and print on top of each
other -- fixed by making the underlying page's own print-area
conditional on the overlay being closed.

## Printer integration: a real adapter interface, one real implementation

`ReceiptPrinterProvider` (`lib/receiptPrinter.ts`) mirrors the
`AttendanceDeviceProvider`/`PaymentProvider` pattern already
established in this codebase (ADR-015, ADR-014): a real interface, and
`BrowserPrintProvider` (`window.print()`) as the one verified
implementation. This is not a lesser fallback for a "real" USB/
network/Bluetooth integration this pass didn't get to -- it is how the
overwhelming majority of real thermal receipt printers actually
integrate with web apps in production, because they install as an
ordinary OS/CUPS printer over USB or network (identical to the desktop
app's own A4-printing mechanism, ADR-012) and the OS print dialog
already lets a user pick 58mm/80mm paper and copy count. Raw ESC/POS
byte-level printing, WebUSB, and WebBluetooth are real, deferred gaps
-- there is no thermal printer connected in this environment to write
and verify that code against, and uncompiled, unverified low-level
device code is a bigger risk than an honest gap (the exact reasoning
ADR-012 already used for cash-drawer control).

**"Download as PDF" is the same `window.print()` call**, not a second,
server-side PDF-generation dependency -- the user picks "Save as PDF"
as the destination in the same OS print dialog. **"Copies" is a UI
hint, not a loop of separate `print()` calls** -- looping would pop up
N separate OS dialogs, worse UX than the copies field every real print
dialog already has.

## UPI QR: real, deterministic, no external service

When `ReceiptSettings.upi_id` and `show_qr_code` are both set, the
frontend encodes a real `upi://pay?...` deep link (amount, payee, a
transaction note carrying the document number) into an actual
scannable QR image via the `qrcode` npm package -- pure client-side
computation, no network call, no third-party payment integration. Not
a fake "coming soon" placeholder: if configured, it is a real,
scannable UPI QR for whatever VPA the admin already accepts payments
to, the same as a printed UPI sticker at any till today.

## A file-name collision, caught by the app failing to boot

The first draft of `services/receipt_templates.py` was written to
`services/receipts.py` without reading that file first -- a real,
pre-existing, load-bearing module (`record_receipt()`, the customer-
payment-against-invoice flow used by Slice 3's collections and Slice
6's portal payment intimation) already lived at that path, and the
write silently overwrote it. Caught immediately by `main.py` failing
to import (`portal.py`'s `from app.services.receipts import
record_receipt`), not by review beforehand. Restored from git,
diagnosed the actual blast radius (`grep` for every importer:
`sales.py`, `pos.py`, `printing.py`, `portal.py`, `tenant_signup.py`),
and moved the new template-engine code to `services/receipt_templates.py`
-- a name that cannot collide with it again.

## Explicitly deferred (backlog, not this pass)

- **Raw ESC/POS, WebUSB, and WebBluetooth printer integration** -- see
  above; `ReceiptPrinterProvider` is the real, ready seam.
- **Server-side PDF generation** -- "Download as PDF" goes through the
  OS print dialog's own Save-as-PDF, not a new PDF-rendering
  dependency; a distinct, literal "download this exact file" button
  (no print dialog at all) is real, separate scope.
- **A true scannable item barcode image** -- SKU renders as monospace
  text (spec's own "SKU / barcode" data field), not a Code-128/EAN
  barcode symbol; generating one is a small, real addition (the
  `qrcode` library's sibling projects handle 1D barcodes too) not
  built this pass to keep the printer-integration and thermal-CSS work
  the priority.
- **Per-document-type template overrides** -- today one `ReceiptSettings`
  row controls every document type uniformly (spec's own "maintaining
  a standard MaterialOS layout" instruction); letting an admin turn
  off GST breakdown on POS receipts specifically while keeping it on
  formal invoices is a real, deferred refinement, not built to avoid
  the config surface area exploding before the shared engine itself
  was proven.
- **Mobile POS** -- the spec names "Web POS, Desktop POS, Mobile POS"
  as targets; this session has not built a distinct mobile POS
  surface (the existing PosPage is mobile-responsive web, same
  reasoning as ADR-005/ADR-012's "mobile-web instead of a second
  native codebase"), so `ReceiptRenderer` is reachable there today
  without a separate mobile implementation.
