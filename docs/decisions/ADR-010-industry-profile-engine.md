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
`ensure_industry_profile_catalog` -- exactly `ensure_permission_catalog`'s
existing pattern, chosen for consistency over inventing a second
seeding mechanism. No admin UI to author new profiles from scratch
exists yet; adding an industry is still a code change (a list entry),
just a small, additive, config-shaped one -- not a schema migration
and not a scattered conditional.

**Correction after a real CI failure**: this ADR originally said both
catalogs are seeded "at app startup" and trusted that. That's wrong in
general -- nothing guarantees `main.py`'s lifespan has run before the
first request, and concretely does not hold for FastAPI's `TestClient`
used without an explicit `with` block, which is how this entire test
suite is written. Locally this was invisible: the dev Postgres
container had already been seeded by many prior `docker-compose up`
runs, so tests always found the catalogs already populated. CI runs
`pytest` against a freshly migrated database with no API process ever
having booted, and the industry-profile tests (being the first in this
codebase to sign up over HTTP and then call a `require_permission`-
gated endpoint) were the first to expose it: empty `Permission` table,
`industry_profiles` holding only the migration-seeded
`building_materials` row. Fixed by making both `ensure_*_catalog`
functions flush-only (composable with any caller's transaction, not
commit-then-walk-away) and calling them from three places: `main.py`'s
lifespan (commits explicitly, since it owns that transaction), inside
`tenant_signup.py` (folded into its existing commit -- a signup must
be correct regardless of whether the process has "started up" in the
traditional sense), and defensively inside `GET /industry-profiles`
itself (the one endpoint reachable with zero other state, so it can't
assume anything ran before it either). Verified against a genuinely
fresh, never-booted Postgres instance (not the long-lived dev
container), not just re-run against already-seeded data.

**Config scope: whole-profile switch, no per-module override table.**
A company gets exactly the modules/nav/dashboard/terminology its
`IndustryProfile` defines. `PATCH /companies/{id}/industry-profile`
(and the Settings > Industry Configuration page) let a company switch
to a *different whole profile* -- a single FK write, no data migration,
since sidebar/dashboard/item-attribute rendering all read the profile
live off `Company.industry_profile_id` already. What's still deferred
is a *per-module* override within a profile (e.g. Building Materials
minus `fleet`) -- that needs a second table (profile default +
company-level overrides layered on top) and wasn't asked for. Minimal
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

**Second addendum: the remaining 20 industries, added on request.**
After Retail and Pharmacy proved the engine (net-new POS module aside),
the user asked for the full 22-industry list from the original brief.
Confirmed via `PROFILE_DEFINITIONS`: adding one really is a plain dict
literal, no migration, no new backend/frontend code -- `ensure_industry_
profile_catalog` picks it up idempotently at the next app start (a
`uvicorn --reload` restart counts). Two tests
(`test_industry_profile.py`) lock the whole batch in: exactly 23 slugs,
no duplicates, and every `enabled_modules`/`dashboard_widgets` entry
across all 23 checked against the actual set the frontend understands
-- both `buildNavigation()` and `DASHBOARD_WIDGETS` silently drop
unknown keys rather than erroring, so a typo would otherwise render as
"that module's nav item is just missing," not a failure.

Two of the twenty -- **Travel** and **Real Estate** -- are honestly
scoped down rather than force-fit: both are project/booking-oriented,
not inventory-item businesses, per the original spec's own §21/§31. They
get `enabled_modules: [sales, ...]` with no `inventory`/`purchase`/
`pos`/`warehouse`/`dispatch`, and `inventory_flags: {}` -- an accurate
reflection of what actually applies, not a padded module list. Their
deeper domain entities (Property/Unit/Booking/Payment Schedule;
Package/Itinerary/Booking) are not built and aren't approximated by
anything here; a Travel or Real Estate tenant today gets generic
quotations/invoicing/collections and nothing else, which is honest but
genuinely thin for those two specifically. The other 18 fit the
existing generic core (sales + inventory + optionally POS +
accounting/GST + dynamic attributes for the industry-specific fields)
well enough to be real, usable configurations, not just placeholders --
`jewellery`'s `pricing_strategy: "weight_making_wastage"` is likewise
informational only (see the field's docstring in models/industry.py):
`resolve_price()` is unchanged for every profile, still rate-contract >
customer-price > standard_price. A per-profile pricing *formula* engine
is unbuilt, same honest-gap treatment as FEFO enforcement above.
