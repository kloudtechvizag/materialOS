# ADR-040: Report card & Analytics PDF export — reused the platform's existing print-to-PDF mechanism

**Context:** the first of four deferred items named across ADR-025
through ADR-039 that the user asked to pick back up ("PDF export,
payment gateway, SMS/WhatsApp, file attachments, etc." — see ADR-041/
042/043 for the other three; SMS/WhatsApp stays out of scope, named
below). ADR-029's own "Deliberately not built" list named "Report
card PDF export / print layout... a formatted printable document is a
separate, later piece"; ADR-037 named the same gap for the Analytics
dashboard.

**No PDF library exists anywhere in this codebase.** The platform's
real, established pattern for "export to PDF" is browser-native
`window.print()` against a `data-print-area`-marked element, backed by
one generic `@media print` rule in `index.css` (ADR-012, already used
by `InvoiceDetailPage`) that hides everything except the marked area
and lifts it out of the app shell's layout. Adding a server-side PDF
library (WeasyPrint, a headless-Chromium-as-a-service render, etc.)
would be a second, parallel export mechanism next to one that already
works — this ADR reuses the existing one instead.

## What shipped

**Report cards** (`StudentDetailPage.tsx`, staff-facing, and
`GuardianPortalChildPage.tsx`, guardian-facing) each gained a `data-
print-area` wrapper around the selected exam's report card block, a
`Printer`-icon "Print" button (`window.print()`, `.no-print`-hidden
from the printed output itself), and a print-only header (`hidden
print:block`) naming the student, admission number, class/section, and
examination — necessary because `data-print-area` hides the rest of
the page including its own `<h1>`, so the printed page needs to be
self-contained.

**Analytics** (`AnalyticsPage.tsx`) gained the same treatment at the
whole-dashboard level: the entire page becomes the print area, with a
"Print / Export PDF" button and a print-only subheader naming the
active campus filter and today's date (replacing the on-screen
description, which is `print:hidden`).

**No backend changes** — every number and every report card field
already existed (ADR-029, ADR-037); this is purely a rendering-layer
addition.

## Deliberately not built in this pass

- **A server-generated PDF file** (for emailing, archiving, or batch
  printing many report cards at once) — the browser's own print-to-PDF
  (`Ctrl+P` → "Save as PDF" in any browser's print dialog) already
  covers the single-document case this ADR scopes to; a batch/
  emailable PDF generation service is real, separate work.
- **Recharts SVG print fidelity was not independently validated beyond
  a visual screenshot pass** — `ResponsiveContainer` renders as SVG,
  which browsers print natively, but no dedicated cross-browser print-
  rendering test suite was added.

## Verification

`tsc --noEmit` and `npm run build` clean. Live-verified via CDP
headless Chromium with `Emulation.setEmulatedMedia({media: "print"})`
against the real `greenwood-demo` tenant: the Guardian Portal's report
card for Aarav Mehta, Mid Term 1, rendered under print emulation as a
clean, self-contained document (title, student/class/exam header, Pass
badge, 89.50%/Grade A, a two-row marks table) with the sidebar, page
chrome, and the Print button itself all correctly absent — confirming
both the visibility rule and the `.no-print` exclusion work together
exactly as the existing `InvoiceDetailPage` precedent already proved
platform-wide.

## Reversibility

Purely additive frontend markup and one reused CSS rule; no schema,
no migration, no new dependency. Removing it is deleting the print
button and its `data-print-area`/print-only-header JSX from three
files.
