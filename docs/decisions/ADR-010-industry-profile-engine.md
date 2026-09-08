# ADR-010: Industry Profile Engine -- catalog shape, config scope, accepted debt

**Context:** the product is expanding from a single Building Materials
ERP to a configurable multi-industry platform (22 verticals in the
long-run backlog). The directive driving this explicitly warns against
`if industry === "..."` branches scattered through the app and against
building all 22 industries at once -- the latter would also violate this
project's own G8 scope discipline. This phase builds the generic engine
and proves it with three profiles: Building Materials (formalized,
zero regression), Retail (POS), Pharmacy (batch/expiry/FEFO).

**Profile storage: a DB catalog, seeded like Permission, not a
migration-only or fully dynamic admin-editable table.** `IndustryProfile`
is platform-level (no `tenant_id`, no RLS -- B9 only governs tenant
data). `building_materials` is seeded directly by its introducing
migration (`892b9921b956`) because it also needs to backfill every
pre-existing `Company.industry_profile_id`. Every other profile
(Retail, Pharmacy, and future ones) ships as a new entry in
`services/industry.py`'s `PROFILE_DEFINITIONS`, seeded idempotently by
`ensure_industry_profile_catalog` at app startup -- exactly
`ensure_permission_catalog`'s existing pattern, chosen for consistency
over inventing a second seeding mechanism. No admin UI to author new
profiles from scratch exists yet; adding an industry is still a code
change (a list entry), just a small, additive, config-shaped one --
not a schema migration and not a scattered conditional.

**Config scope: profile-level only, no per-company override table.**
A company gets exactly the modules/nav/dashboard/terminology its
`IndustryProfile` defines. The 22-industry spec's "Settings > Industry
Configuration" is read-only in this phase (view the active profile);
per-company toggles beyond the profile default are deferred. Minimal
now, reversible seam later -- same discipline as every prior ADR here.

**Terminology scope: nav labels + Customer/Item page headers, not a
full-app string sweep.** Rewriting every hardcoded string in ~35 routes
to route through a terminology lookup is a different, much larger task
than proving the engine works, and isn't needed to validate Retail or
Pharmacy.

**Batch.expiry_date is generic; Batch.heat_number is accepted debt.**
`expiry_date` is a plain nullable column, not pharmacy-specific naming,
because any perishable good can use it (FEFO picking reads it when
`IndustryProfile.inventory_flags.fefo` is set). `heat_number` (steel
traceability) predates this ADR and stays as-is -- a harmless nullable
column on a shared table, not worth a migration to relocate into
`Item.attributes` purely for naming purity.

**Tax/accounting stays India-GST-only.** `resolve_tax()` and
`SYSTEM_ACCOUNTS` (ADR-004) are unchanged. Retail and Pharmacy are
still Indian GST businesses, so generalizing to other tax regimes isn't
required to prove this engine and is out of scope here.

**Reversibility:** all of the above are additive seams. A per-company
override table can be introduced later without touching
`IndustryProfile`'s shape. A full terminology sweep can follow
page-by-page. Multi-tax-regime support, if ever needed, replaces
`resolve_tax()`'s internals behind its existing interface (ADR-004)
without touching this engine.

**Addendum after building Retail (Slice E) and Pharmacy (Slice F):**

*Retail's POS is real net-new code, not configuration.* No
walk-in/counter-sale flow existed before this (Master Brief Part C
names `WalkInSale` as a concept; it was never built). `WalkInSale` is a
thin header around a real `Invoice` -- line pricing/tax reuses
`price_line()`, stock deduction reuses `apply_ledger_movement()`,
payment reuses `record_receipt()` once per non-zero payment leg, and
the journal reuses `invoicing.py`'s `_post_invoice_journal()` directly
(imported despite its underscore prefix -- B13 says this arithmetic
lives in exactly one place, and duplicating it to avoid importing a
"private" function would violate that harder than the import does). A
walk-in sale settles in full at checkout: the three payment-mode
amounts must sum to exactly `Invoice.total`; `tendered_amount` is a
separate physical-cash-handling field so cash change can be calculated
without ever asking `record_receipt()` to overpay a targeted invoice
(it deliberately rejects that). Every tenant without a named customer
gets one lazily-created `Customer` row named "Walk-in Customer" per
company, because `Invoice.customer_id` is not nullable and every other
module (Customer 360, credit checks, receivables ageing) assumes a
real customer exists.

*Pharmacy's FEFO is honestly scoped down from the original plan.*
Investigating before building surfaced that `catalog.Batch` was --
and, after this slice, mostly still is -- a dormant table: nothing in
`services/` or `api/v1/` outside this slice ever wrote or read a
`Batch` row before now (confirmed by grep: only the Tally/Busy importer
even imports the name, and that's a different, unrelated `ImportBatch`
model). `StockLedger`/`StockReservation`/`apply_ledger_movement` all
operate at `(warehouse, item)`, with no batch dimension at all. So
"add FEFO ordering to the existing batch-selection code" (this ADR's
original plan) had no existing code to add it to. Building full
batch-dimensioned stock movement now would touch the core ledger for
every industry, not just Pharmacy -- a much bigger, riskier change than
"prove the engine generalizes," and exactly the kind of unbuilt-until-
justified gap ADR-002 already accepted for opening stock. What ships
instead: `Batch.expiry_date` (generic column), `POST/GET /batches`
(the first time `Batch` has ever been reachable via the API),
`near_expiry_batches()` (a plain date-filtered query), and a dashboard
widget/notification surfacing it. `IndustryProfile.inventory_flags.fefo`
is set to `true` for Pharmacy as a declared intent for when batch-aware
picking exists, not a claim that picking honors it today --
`near_expiry_batches()`'s docstring says this explicitly so the gap
can't be missed by a future reader. Real FEFO enforcement is backlog:
it needs goods receipt (or some stock-in path) to assign incoming
stock to a batch, and dispatch/POS picking to consult it -- both
currently absent for every profile, not a Pharmacy-specific gap.
