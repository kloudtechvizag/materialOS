# ADR-031: Fee Management — reusing the core invoicing stack, not a parallel ledger

**Context:** Phase 4 of MaterialOS Education. Before writing any code,
this slice audited the existing core accounting infrastructure
(`Invoice`, `InvoiceItem`, `Customer`, `Item`, `Receipt`,
`PaymentAllocation`) to answer one question first: does a school fee
need its own ledger, or is it just another billable, non-stock
service this codebase already knows how to invoice? The audit found
`services/printing.py`'s `complete_job_and_invoice` already
establishes the exact precedent needed — a non-stock service line
(print job charges), invoiced through the same GST-resolution and
journal-posting code every other document type uses, with stock
deduction only touched when a job explicitly links one. A school fee
is architecturally identical: real money owed by a real billing party
for a non-physical service. Building a parallel fee ledger next to a
working, tested, GST-correct invoicing system would have been the
"fake functionality" this project explicitly guards against — a
lesser, duplicate implementation where a real one already exists.

## What shipped

**One additive column**: `Guardian.customer_id` (migration
`f0a1b2c3d4e5`), the same lazy self-service-anchor pattern as the
existing `Guardian.user_id`/`Employee.user_id` — a guardian gets a
real `Customer` row only the first time fees are actually invoiced for
them (`get_or_create_guardian_customer`, mirroring `services/pos.py`'s
`get_or_create_walkin_customer` exactly), not speculatively at
guardian-creation time.

**Four new tables** (`models/fees.py`, migration `2b5204ab912e`):

- `FeeHead` — a billable fee type ("Tuition Fee"), backed by a real,
  dedicated `Item` (`gst_rate=0` — school fees are GST-exempt
  education services in India) created in the same transaction. Every
  fee invoice line for this head runs through the exact tax-resolution
  code (`resolve_tax`) every other invoice line in this codebase does.
- `FeeStructureItem` — what a class is charged for a fee head in an
  academic year (amount + due date). Installments are simply more fee
  heads (e.g. "Tuition Term 1", "Tuition Term 2"); no separate
  installment concept was introduced.
- `FeeInvoice` — bridges a real core `Invoice` back to the `Student` it
  was raised for (`Invoice` itself only knows the billing `Customer`,
  never the student).
- `FeeInvoiceLine` — one (student, fee_structure_item) billed pair,
  with a real uniqueness constraint that makes double-billing the same
  student for the same fee line structurally impossible, even if
  `generate_fee_invoices` is re-run (e.g. for students enrolled after
  the first run) — already-billed pairs are silently skipped, not
  re-charged.

**`generate_fee_invoices`** is modeled directly on
`complete_job_and_invoice`: for every currently-enrolled student in
the chosen class, resolves their real primary guardian (via
`StudentGuardian.is_primary_contact`) — raising a named, explicit
`VALIDATION_ERROR` if a student has none, rather than silently
skipping or picking an arbitrary guardian — gets-or-creates that
guardian's `Customer`, builds one real `Invoice` + `InvoiceItem`(s)
from the selected `FeeStructureItem`s, posts the balanced journal via
the exact same (cross-module-imported, same precedent as
`printing.py`) `_post_invoice_journal`, and records the `FeeInvoice`/
`FeeInvoiceLine` bridge rows. Returns which students were actually
billed and which were skipped as already fully billed for the
selected items — an honest response, not a silent no-op.

**Fee collection reuses the existing `POST /receipts` endpoint
as-is** — no new payment endpoint was built. A fee payment is just a
receipt against a real invoice; `record_receipt`'s existing partial-
payment and outstanding-calculation logic works unmodified.
Receivables ageing (`services/collections.py`) and outstanding
(`services/credit.py::compute_outstanding`) already work for fee
invoices with zero new code, since both are generic over `Customer` +
`Invoice`.

**Frontend**: `FeesPage` (fee heads, per-class fee structure, and a
checkbox-driven invoice generation flow scoped to one class + branch
at a time). `StudentDetailPage` gained a "Fees" card showing each real
invoice with its live outstanding balance and a "Record payment"
action that calls the existing `/receipts` endpoint directly.

## Deliberately not built in this pass

- **Scholarships / fee concessions** as a first-class discount — not
  modeled; a school would have to create a lower-amount `FeeStructureItem`
  per exception today.
- **Late-fee penalty calculation** — no automatic penalty accrual past
  a due date.
- **Online payment gateway integration** — `Receipt.mode` already
  accepts `"upi"`/`"card"` for a staff-entered payment, but no gateway
  webhook exists to record one automatically.
- **Parent-facing "pay my fees" self-service** — same Phase 5 portal
  dependency named in every prior education ADR.

## Verification

6 new backend tests (`test_fees.py`), all through the real HTTP API:
module-gating (403), fee head creation backs a real invoiceable
`Item`, invoice generation produces a real posted `Invoice` (verified
independently via `GET /invoices/{id}`), re-generating the same fees
does not double-bill (skipped-student tracking verified), generating
for a student with no primary guardian is rejected (400), and paying
through the pre-existing `/receipts` endpoint correctly reduces the
fee invoice's outstanding balance. Full backend suite: 260 passed (254
+ 6 new), zero regressions — notably including no failures from the
DB's own debit-must-equal-credit journal trigger, which would have
fired immediately had the accounting integration been wrong. `tsc
--noEmit`, `vite build`, `npm run check:nav-modules` all clean.

Live-verified end to end on a fresh "Fee Test School" tenant: created
a real fee head and per-class fee structure through the UI (no seed
data), generated an invoice for one student, and confirmed the exact
generated invoice number (`INV-2026-27-000001`, the same FY-scoped
gapless numbering every other document type uses) appeared correctly
on the student's own profile page. Recorded a ₹3,000 partial payment
against the ₹8,000 invoice through the "Record payment" UI and
confirmed the outstanding balance updated to ₹5,000 both on-screen and
via a direct API cross-check. Went one level deeper than prior ADRs'
verification and queried the actual `journal_entries`/`journal_lines`
tables directly for both the invoice and the receipt, confirming each
posted a genuinely balanced double-entry (debit = credit = 8000.0000
and 3000.0000 respectively) — not just that the API calls succeeded,
but that the underlying accounting is correct.

## Reversibility

Mostly additive: one new nullable column on an existing table
(`guardians.customer_id`, own migration + downgrade), four new tables
(own migration + downgrade), one new permission resource (own backfill
migration), one new nav item, one new frontend page, one new card on
`StudentDetailPage`. No existing table, model, endpoint, or route was
modified — `/receipts` and every core invoicing function were called,
never changed.
