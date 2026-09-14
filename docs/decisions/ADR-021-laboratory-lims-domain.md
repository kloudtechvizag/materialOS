# ADR-021: Laboratory & Scientific Testing (industry #25) — the real walking skeleton

**Context:** an 88-section master prompt asked for a full LIMS domain
inside MaterialOS — samples, accessioning, worksheets, instrument
integration (ASTM/HL7/FHIR), a full QMS (deviations/CAPA/audits),
electronic signatures, storage hierarchies, chain of custody, multi-site
routing, an AI Lab Copilot, and more. The prompt's own §78 phases this
work and explicitly says not to attempt it all in one pass. This ADR
covers exactly one slice, chosen by the user: the **core sample spine**
from §3/§88 — Client → Test Catalog → Sample Registration → Barcode →
Accession (accept/reject) → basic Result Entry → basic Report → Audit.

Confirmed before writing any code: **zero prior laboratory/LIMS code
existed anywhere in this codebase.** Unlike every other industry
profile, this is genuinely new domain modeling, not configuration over
an existing generic core — matching the master prompt's own explicit
warning in §2 not to force sample/test/result into generic
Product/Order/Invoice/Inventory tables.

## What shipped

**New tables** (`models/laboratory.py`, migration `a7b8c9d0e1f2`):
`lab_sample_types`, `lab_containers`, `lab_test_definitions`,
`lab_samples`, `lab_test_orders`, `lab_results`, `lab_reports`. All
seven are tenant-scoped with standard RLS and the `audit_trg` trigger
(the same "human-driven record worth a diff" treatment as
customers/items/suppliers, not the append-only-ledger treatment).
**Client reuses the existing `Customer` model** (spec §28 explicitly
asks for this) rather than a new `lab_clients` table.

**Real state machine** (`services/laboratory.py`), proven end-to-end
over real HTTP requests (`tests/test_laboratory.py`, 9 tests) and live
against the running stack (real signup, real sample registration
through the actual Items-style dynamic form, real accession/accept/
result-entry/validate/authorize/report/supersede, screenshotted at
every step):

- `register_sample` → `accession_sample` → `accept_sample` /
  `reject_sample` (a rejection requires a reason, and a rejected
  sample cannot later be accepted — a real 409, not a UI-only
  restriction).
- `enter_result` computes a real `flag` (`normal`/`abnormal`/
  `critical`) against the test's own reference and critical ranges,
  and moves the sample to `in_process` automatically.
- `validate_result` → `authorize_result` implements spec §46's
  segregation of duties **for real**: the user who entered a result
  cannot authorize it (a 409, verified live with two real user
  accounts, not just unit-tested). This is a real check, not a
  compliant electronic signature (§36) — there is no re-authentication
  step, named here so the gap can't be missed later.
- Once every test order on a sample is authorized, the sample
  auto-completes; `generate_report` is blocked (409) until then.
- `supersede_report` **never overwrites** a released report (spec
  §35): it creates a new row at `version + 1` and flips the old row to
  `superseded`, live-verified — both versions remain independently
  fetchable via `GET /lab/samples/{id}/reports`.

**Numbering**: `sample_number` and `report_number` reuse the existing
gapless, concurrency-safe `next_document_number()` (the same mechanism
invoices/quotations already use) — `LAB-2026-27-000001`-shaped, not a
new ad-hoc counter.

**Permissions**: a new `laboratory` resource in
`services/permissions.py::RESOURCES`, backfilled onto every existing
tenant's owner role by migration `b8c9d0e1f2a3` — pre-empting the
"new resource never reaches existing tenants" bug this project has
already hit and fixed twice before (ADR-014's own retrospective).

**Industry profile #25**: `slug: "laboratory"`, `enabled_modules:
["laboratory"]` — a real module key, gating a real "Laboratory" sidebar
section (Samples, Test Catalog) via the same `buildNavigation()`
mechanism every other profile uses. Like Printing Press before it, this
is **not config-only** — real new tables and a real service layer back
the module, not a relabeled generic screen.

**Frontend**: `/lab/samples` (list + register dialog, with inline
quick-add for sample types), `/lab/samples/:id` (the full workflow —
accession/accept/reject buttons, per-test result entry, validate/
authorize actions, report generation and supersede), `/lab/test-catalog`
(test definition CRUD with reference/critical range fields).

## Deliberately NOT built in this pass (named, not faked)

Every one of these is a real, later gap — not approximated by anything
shipped here:

- **Aliquot genealogy** (§9) — splitting one sample into independently
  trackable child aliquots. This pass tracks one sample's whole-sample
  movement, not sub-sample lineage.
- **Reflex/dilution/repeat rules** on the test catalog (§11).
- **Multi-stage technical/QC/pathologist review** — collapsed to a
  single entry → validate → authorize chain, not the fuller pipeline
  in §17.
- **Competency-gated RBAC** (§41, §45) — any user with the `laboratory`
  permission set can perform any role's actions; there is no per-user
  method/instrument authorization check.
- **Electronic signatures** (§36) — the segregation-of-duties check is
  real, but it is not a compliant e-signature (no re-authentication,
  no signature meaning/reason capture).
- **Customer portal, billing integration, outsourced testing, multi-
  site routing, accreditation scope, document control, training
  records, the Lab Copilot / AI orchestration, and the Laboratory
  Command Center dashboard** — all named in the master prompt, none
  attempted here. `dashboard_widgets: []` for this profile is
  deliberate, not an oversight — a real lab dashboard needs real data
  behind it (pending/overdue tests, QC status) that doesn't exist yet.
- **Barcode as a distinct symbology / separate accession number** —
  `sample_number` doubles as both, and as the barcode payload. A real
  1D-barcode-rendering library isn't part of this codebase's
  dependencies (only `qrcode` is); adding one, or rendering a QR code
  of the sample number, is a real follow-up, not attempted here.

## Verification (core sample spine)

9 new backend tests (full lifecycle, rejection, early-result-entry
block, self-authorization block, reference/critical flag computation,
report versioning, RBAC denial, tenant isolation) — all passing inside
`materialos_api_1` against the real Postgres. Full suite: 168 passed,
zero regressions. Frontend `tsc --noEmit` and production build both
clean. Live-verified against the running `docker-compose` stack: a
real tenant signed up under the `laboratory` profile, a real test
definition and customer created via the actual UI/API, a real sample
registered through the real dynamic-attribute-driven form, driven
through every workflow state with two distinct real user accounts
(proving segregation of duties is enforced, not just documented), and
a real report generated and superseded — screenshotted at each step.

## Addendum: QC subsystem (blanks/controls/duplicates)

A second pass, again chosen explicitly by the user from the named gap
list above rather than assumed. §19's QC subsystem is real here, not
config-only — but deliberately scoped down from the spec's full
worksheet-based design, since Worksheets (§15) are still a named,
unbuilt gap.

**New tables** (same `models/laboratory.py`, migration
`c9d0e1f2a3b4`): `qc_reference_samples`, `qc_runs`, plus a new
`duplicate_rpd_limit_percent` column on `lab_test_definitions`. Both
new tables carry standard RLS and `audit_trg`.

**Design decision — one mechanism for blanks and controls.** The
spec's §30-31 model a separate "Reference Sample" and "Reference
Analysis" pair (a reusable reference material supporting many
analyses, each with its own expected-result row). This ADR instead
merges them into one `QcReferenceSample` row per control/blank *for
one specific test*, carrying its own `expected_low`/`expected_high`
range directly — a real simplification, not a fake one: blanks and
controls are structurally identical here (both compare a submitted
result against a fixed range), differentiated only by the reference
sample's own `qc_type`. `record_reference_qc_run()` is the single
function backing both.

**Design decision — QC gates at the test-definition level, not the
worksheet level** *(superseded by the Worksheets addendum below —
kept here for the historical record of this pass's own reasoning)*.
The spec's real intent (§67) is that a failed QC run blocks release for
*the batch of samples run alongside it* on one worksheet. Since
Worksheets didn't exist yet at this point, that scoping wasn't
buildable honestly. The substitute shipped in this pass was coarser but
still real: `authorize_result` checked the single *most recent*
`QcRun` for that result's test definition, of any type (blank/control/
duplicate). A fail blocked authorization (409) until a fresh run for
that same test passed. No QC run ever recorded for a test did not
block — a lab that hadn't configured QC for a given test yet wasn't
bricked by this feature. The next addendum makes the real per-worksheet
scoping buildable and keeps this exact fallback for test orders that
are never put on a worksheet.

**Duplicates**: `record_duplicate_qc_run()` computes a real RPD
(Relative Percent Difference) against the original result:
`abs(original − duplicate) / ((original + duplicate) / 2) × 100`,
quantized to 2 decimal places. Without a `duplicate_rpd_limit_percent`
configured on the test, the run is still recorded (for the historical
record) but always reads as `pass` — matching this project's
established rule of never fabricating an acceptance threshold that
wasn't actually configured (the same reasoning as `inventory_flags`
being informational-only absent a module that reads them).

**Frontend**: new `/lab/qc` page — per-test reference-sample catalog
(create blank/control with expected range), inline "Record run" per
reference sample, and a run-history panel showing pass/fail per run.
Wired into `lib/navigation.ts` under the existing Laboratory section
and into `App.tsx`.

**Deliberately still not built** (as of this second pass; worksheet
scoping was closed by the third pass below): Levey-Jennings charts
(§65) and Westgard multi-rule statistics (§66).

## Verification (QC subsystem)

6 new backend tests
(`tests/test_laboratory_qc.py`) — control pass/fail against a real
range, blank using the same mechanism, duplicate RPD computed and
checked against a configured threshold (verified at both 2.82% pass
and 25.0% fail), duplicate without a configured threshold always
passing, invalid `qc_type` rejected, and the key integration test: a
failing QC run blocking `authorize_result` with a 409, then a fresh
passing run clearing the block — all passing inside `materialos_api_1`
against the real Postgres. Full suite: 177 passed, zero regressions.
Frontend `tsc --noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium/CDP: a real `laboratory`-profile tenant, a real reference
sample ("pH 7.00 Buffer", range 6.90-7.10) created through the actual
`/lab/qc` dialog, a real passing run (7.02) and a real failing run
(6.50) recorded through the UI and shown correctly in the run-history
panel with pass/fail badges. Separately, with a second real analyst
user entering and validating a result and the owner then attempting to
authorize it: the Sample Detail page surfaced the QC-block error while
the most recent run was a fail, and authorization succeeded immediately
after a fresh passing run was recorded — the same 409-then-200 sequence
proven in the backend test, reproduced live end-to-end. The sidebar's
Laboratory section correctly shows the new "Quality control" nav item
alongside Samples and Test catalog.

## Addendum: Worksheets (batch testing)

A third pass, again chosen explicitly by the user, continuing straight
through the remaining named LIMS gaps (Worksheets, Instruments, full
QMS, Storage, Client Portal). §15's worksheet concept is real here —
not a relabeled list view — and it closes the QC subsystem's own named
gap: QC gating now happens at the *worksheet batch* level the spec
actually intends (§67), not just the coarser test-definition-wide
fallback from the second pass.

**New table** (`models/laboratory.py`, migration `d0e1f2a3b4c5`):
`lab_worksheets` — a batch of test orders for one test definition, run
together by one analyst. Standard per-tenant RLS + `audit_trg`, same
treatment as every other real record in this domain. Two existing
tables gained a nullable `worksheet_id` opt-in column: `lab_test_orders`
(a test order belongs to at most one worksheet, so membership is a
column, not a join table) and `qc_runs` (a QC run can be recorded
*against* a specific worksheet).

**Design decision — membership via column, not a join table.** Since
one test order can only ever be on one worksheet at a time (spec's own
mental model — you run a batch once), `LabTestOrder.worksheet_id`
records membership directly. This is deliberately NOT a fixed-position
plate map (§15's well/slot positions) — `worksheet_id` records *that*
a test order is on a worksheet, not *where*. Named as a later gap, not
silently approximated.

**Design decision — QC gating now scoped to the worksheet, with a
real fallback.** `authorize_result` calls a rewritten `_latest_qc_status`
that checks the most recent `QcRun` scoped to the specific worksheet a
result's test order belongs to (`QcRun.worksheet_id == test_order.
worksheet_id`) when one exists, and only falls back to the old
test-definition-wide most-recent-run check (ignoring worksheet
entirely) for test orders that were never added to any worksheet. This
means a failing QC run on Worksheet A blocks only Worksheet A's own
results — a passing run on Worksheet B for the *same test definition*
is unaffected, proven directly by both a backend integration test and
live browser verification below. QC runs can only be attached to a
worksheet that is still `open` or `in_progress` (not `completed`), and
only for that worksheet's own test definition — enforced in
`_require_open_or_in_progress_worksheet_for_test`, preventing a QC run
from silently gating the wrong batch.

**Worksheet lifecycle**: `open` (being populated; `add_test_order_to_
worksheet` / `remove_test_order_from_worksheet` validate the test order
matches the worksheet's test definition, isn't already on another
worksheet, and is still `ordered`) → `start_worksheet` (`in_progress`,
requires at least one test order) → `complete_worksheet` (`completed`,
requires every test order on the worksheet to have at least a result
entered — validate/authorize remain each result's own per-result
workflow, not gated by worksheet completion). `worksheet_number` reuses
the same gapless `next_document_number()` mechanism as `sample_number`
and `report_number` (`WS-2026-27-000001`-shaped).

**Frontend**: new `/lab/worksheets` page (list + create dialog) and
`/lab/worksheets/:id` (add/remove test orders from an "unassigned test
orders" panel powered by a new `GET /lab/test-orders/unassigned`
endpoint, start/complete actions, inline result entry per test order,
and a worksheet-scoped QC panel — record a reference run against
*this worksheet specifically*, with its own run-history panel and a
block banner when the worksheet's most recent QC run failed). Wired
into `lib/navigation.ts` (a new "Worksheets" item between Test catalog
and Quality control) and `App.tsx`.

**Deliberately NOT built**: worksheet templates / fixed-position plate
layout (§15), multi-test-definition worksheets (one worksheet is
always scoped to exactly one test), and re-running a worksheet in
place (a new worksheet must be created instead) — named gaps, not
silent omissions.

## Verification (Worksheets)

9 new backend tests (`tests/test_laboratory_worksheets.py`) — a
worksheet groups test orders for one test definition and rejects a
mismatched one (422), a test order cannot be on two worksheets at once
(409), a worksheet cannot start empty or complete with unresulted
orders (409 both), removing a test order frees it for another
worksheet, the unassigned-test-orders endpoint correctly excludes
already-assigned ones, a QC run cannot be attached to a completed
worksheet (409), RBAC denial and tenant isolation (404/401) — plus the
two key integration tests: **worksheet-scoped QC gates only that
worksheet's results** (a failing run on Worksheet A blocks Worksheet
A's result with a 409 while Worksheet B's result for the same test
definition authorizes successfully with its own passing run, then a
fresh passing run on Worksheet A clears its block), and **a result
never put on any worksheet still uses the old test-definition-wide QC
fallback** (proving backward compatibility with the second pass) — all
passing inside `materialos_api_1` against the real Postgres. Full
suite: 186 passed, zero regressions (up from 177). Frontend `tsc
--noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium/CDP: a real worksheet ("WS-2026-27-000001") created through
the `/lab/worksheets` dialog, two real unassigned test orders added
through the detail page's "Add test orders" panel, the worksheet
started, both test orders resulted through inline result entry, a real
QC reference sample and a real failing run (6.00, outside 6.90-7.10)
recorded against this specific worksheet through its own QC panel —
the block banner appeared on the worksheet detail page ("This
worksheet's most recent QC run failed..."). With a second real analyst
user validating the result and attempting to authorize it, the Sample
Detail page surfaced the new worksheet-scoped error message ("The most
recent QC run failed for this worksheet's scope...") — proving the
scoping is real end-to-end, not just in the test suite. A fresh passing
run (7.01) against the same worksheet cleared the block, and
authorization succeeded (sample moved to `completed`, result
`authorized`). The worksheet was then completed through its own
"Complete worksheet" button once both test orders had results, moving
its status to `completed` and correctly hiding the "record run"
controls (a completed worksheet's QC panel is read-only). The sidebar's
Laboratory section correctly shows the new "Worksheets" nav item
between Test catalog and Quality control.

## Addendum: Instruments (CSV result import)

A fourth pass, continuing straight through the user's remaining named
LIMS gaps. §21-23 asks for ASTM E1394/HL7 v2.x instrument integration.
This addendum deliberately does **not** attempt a live wire protocol:
this codebase has no real instrument to connect to and no verified
serial/TCP driver stack, and shipping an untested protocol
implementation would itself be fake functionality dressed up as real
(the project's own standing "no fake functionality" rule). What's
real instead is a genuinely common pattern for labs without HL7
middleware budget: instruments export a flat CSV of results, and that
file gets imported.

**New table** (`models/laboratory.py`, migration `e1f2a3b4c5d6`):
`lab_instruments` — a real catalog entity (code, name, manufacturer,
model), standard per-tenant RLS + `audit_trg`. `lab_results` gained a
nullable `instrument_id` column: null means a human keyed the result
in manually (the walking-skeleton path, unchanged); set means it came
from a CSV import.

**Design decision — reuse `enter_result`, don't fork it.** `import_
instrument_results` matches each CSV row (`sample_number`, `test_code`,
`result_value`) against a *pending* (`status == "ordered"`) test order
for that sample and test, then calls the exact same `enter_result()`
service function manual entry uses, and only afterwards stamps
`instrument_id` on the row it created. This means an imported result is
not a second-class record with its own parallel rules: it gets the
same numeric parsing, the same reference/critical flag computation, and
— proven directly by a backend test — the same segregation-of-duties
enforcement at authorize time (the user who triggered the CSV import is
`entered_by_user_id`, so *they* cannot also authorize the imported
result; a different user must, exactly as for manual entry).

**Design decision — real per-row error reporting, not silent
drops or an all-or-nothing batch.** Every row in the CSV gets an
outcome: `imported` (with the created `result_id`) or `error` (with a
specific message — unknown sample number, unknown test code, no
pending test order for that sample+test, or a malformed row). One bad
row never aborts the rest of the file, and a bad row is never silently
skipped without being reported back to the user. This mirrors the
project's general error-handling posture (validate and report real
problems, never fabricate success).

**Design decision — a direct-commit endpoint, not the existing
`ImportBatch` staged-wizard framework.** The codebase already has a
generic `ImportBatch`/`ImportBatchRow` pipeline (upload → map →
validate → preview → commit), but it's purpose-built for accounting
imports (`SOURCE_TYPES = tally_xml, busy_csv, marg_csv`; `ROW_TYPES =
customer, supplier, item, opening_balance`) where column mapping and a
review step genuinely matter. An instrument's result file has a fixed,
small, self-describing shape (three columns, generally a handful to a
few hundred rows) where a staged multi-step review adds friction
without adding safety — the real safety net here is the per-row error
report, returned synchronously in the same request. Forcing this
through the accounting wizard would have meant bending `ROW_TYPES` and
`SOURCE_TYPES` to a shape they were never designed for; a dedicated
endpoint was the honest choice, not a missed reuse opportunity.

**Frontend**: new `/lab/instruments` page — instrument catalog (create
with code/name/manufacturer/model) and a real CSV upload per
instrument via a hidden file input, rendering the same per-row
imported/error outcome the backend returns. Wired into
`lib/navigation.ts` (a new "Instruments" item between Worksheets and
Quality control) and `App.tsx`.

**Deliberately NOT built**: a live ASTM E1394/HL7 v2.x/FHIR listener
(TCP or serial), instrument-specific result-format parsers beyond the
generic three-column CSV, and automatic/scheduled polling of an
instrument's export folder (import is always a real, explicit user
action) — named gaps, not silent omissions.

## Verification (Instruments)

8 new backend tests (`tests/test_laboratory_instruments.py`) — creating
and listing an instrument, a CSV row matching a pending test order and
tagging the created result with `instrument_id`, unmatched rows
(unknown sample, unknown test code) reported per-row without failing
the rest of the batch, a row for an already-resulted test order
rejected with a specific message, import against a nonexistent
instrument (404), a CSV missing required columns rejected (400), RBAC
denial and tenant isolation (404/401) — plus the key correctness test:
an imported result still goes through the exact same validate/
authorize pipeline as a manual one, including segregation of duties
(the importing user is blocked from authorizing their own import; a
different user succeeds) — all passing inside `materialos_api_1`
against the real Postgres. Full suite: 194 passed, zero regressions (up
from 186). Frontend `tsc --noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium/CDP: a real instrument ("AU680", Beckman Coulter) created
through the `/lab/instruments` dialog, a real two-row CSV (one row
matching a real accepted sample's pending test order, one row
referencing a sample number that doesn't exist) uploaded through the
page's real file input — the import result panel showed "1 imported ·
1 error" with the matching row marked "imported" and the unmatched row
marked "error" carrying the exact backend message ("No sample numbered
'LAB-DOES-NOT-EXIST'."). A direct API check confirmed the imported
result landed on the sample with the correct value (7.25), the correct
auto-computed flag (`normal`, within the test's reference range), and
the correct `instrument_id`. The sidebar's Laboratory section correctly
shows the new "Instruments" nav item between Worksheets and Quality
control. (One tooling note for the record: the CDP verification
harness's file-upload helper initially attached a 0-byte file via
`DOM.setFileInputFiles`, which made the browser's own `fetch()`
immediately reject the multipart request — worked around by
constructing a real in-page `File`/`DataTransfer` with actual CSV
content and dispatching a native `change` event instead, which
exercises the exact same production code path.)

## Addendum: Storage & chain of custody

A fifth pass, continuing straight through the user's remaining named
LIMS gaps. §8-10 asks for a storage hierarchy and a real chain-of-
custody ledger. Both are real here.

**New tables** (`models/laboratory.py`, migration `f2a3b4c5d6e7`):
`lab_storage_locations` (self-referencing via `parent_location_id` --
freezer → shelf → rack → box, or as shallow or deep as a lab needs, one
generic hierarchy rather than named tables per level) and `lab_
custody_events` (a genuine append-only ledger: rows are only ever
inserted, service functions never update or delete one). `lab_samples`
gained a nullable `current_location_id` — a deliberate denormalized
fast-lookup pointer to *today's* location, kept in sync by every
custody event, while `lab_custody_events` remains the durable
historical record of how the sample got there.

**Design decision — `from_location_id` is never caller-supplied.**
`record_custody_event` always sets `from_location_id` to the sample's
own `current_location_id` at the moment the event is recorded, reading
it server-side rather than accepting it as a request field. This closes
off the obvious way a client could corrupt the ledger (claiming a
sample moved from a location it was never actually at) — the ledger's
integrity comes from the server being the sole author of "where it
was," not from client-side trust. Proven directly by a backend test: a
`stored` event followed by a `moved` event confirms the second event's
`from_location_id` is the *first* event's target, never something the
request body could override.

**Design decision — `checked_out`/`disposed` leave tracked storage
on purpose.** Every event type requires a real `to_location_id` except
these two, which explicitly reject one (422 if supplied) — a sample
being pulled for testing or discarded isn't "at" a storage location
anymore, and `current_location_id` is set to `null` to reflect that
honestly rather than pointing at a stale last-known location.
`disposed` is additionally a real terminal state: `record_custody_
event` checks the sample's most recent event and returns 409 for any
further event once it's `disposed`.

**Frontend**: new `/lab/storage` page (location hierarchy: create with
an optional parent, showing type/temperature/parent in a flat table)
and a "Storage & custody" section added to the existing Sample Detail
page — current location, a "Record event" dialog (event type, and a
location picker that disappears entirely for `checked_out`/`disposed`,
matching the backend rule instead of just validating it after the
fact), and the full chronological event history. Wired into
`lib/navigation.ts` (a new "Storage" item between Instruments and
Quality control) and `App.tsx`.

**Deliberately NOT built**: aliquot genealogy (splitting one sample
into independently trackable child aliquots — sec9), location capacity
limits or occupancy maps, and temperature excursion alerting (the
`temperature_c` field is informational, not monitored against any real
sensor feed) — named gaps, not silent omissions.

## Verification (Storage & chain of custody)

7 new backend tests (`tests/test_laboratory_storage.py`) — a two-level
storage hierarchy nests correctly and an unknown `location_type` or a
nonexistent parent is rejected, a custody event auto-captures `from_
location_id` from the sample's own prior state across a `received` →
`stored` sequence and updates `current_location_id`, `checked_out`/
`disposed` reject a target location (422) and correctly clear `current_
location_id` to null, a disposed sample blocks any further custody
event (409), a location-requiring event without a target location is
rejected (400), an invalid `event_type` is rejected (400), RBAC denial
and tenant isolation (404/401) — all passing inside `materialos_api_1`
against the real Postgres. Full suite: 201 passed, zero regressions (up
from 194). Frontend `tsc --noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium/CDP: a real two-level hierarchy ("Freezer 1" at -20.0°C, with
"Shelf 2" nested under it) created through the `/lab/storage` page —
the table correctly showed "Shelf 2"'s parent as "Freezer 1". On a real
sample's detail page, a `received` event to Freezer 1 was recorded
through the "Record event" dialog and the page immediately showed
"Current location: Freezer 1" with a "Received: -- → Freezer 1" history
row (the `--` correctly reflecting no prior location). A `moved` event
to Shelf 2 was then recorded, and the history showed "Moved: Freezer 1
→ Shelf 2" — the `from` side captured automatically from the sample's
actual prior location without ever being supplied by the browser,
proving the server-side capture live, not just in the test suite. The
sidebar's Laboratory section correctly shows the new "Storage" nav item
between Instruments and Quality control.

## Reversibility

Fully additive across all five passes: seven migrations total (domain
tables, permission backfill, QC tables, worksheet table + two opt-in
columns, instrument table + one opt-in column, storage tables + one
opt-in column), one service/router/schema module extended five times,
one industry profile entry, eight frontend routes, and six nav items
gated on the `laboratory` module. None of it touches any existing
table, endpoint, or profile. Removing it means dropping the seven
migrations and the industry-profile entry — no other domain depends on
`lab_*` or `qc_*` tables.

## Addendum: "Create where you work" (Sample Registration)

A platform-wide 80-section spec asked for a universal quick-create
capability — never send a user away from a workflow just because a
referenced record (customer, sample type, container, ...) doesn't
exist yet. Before building anything, an audit found this is **not**
green-field: `SearchableSelect` (a real searchable combobox with a
built-in "+ Quick Add" row) and `QuickAddContactModal`/`QuickAddItemModal`/
`QuickAddProjectModal`/`QuickAddSiteModal` already exist and are live in
two real screens (New Quotation, Purchase Orders). What was missing was
LIMS itself: Sample Registration's Client, Sample Type, and Container
fields were still plain `<select>` elements, and Sample Type had only a
one-off inline "New type..." input duplicating logic the platform
pattern already generalizes. This addendum closes that specific gap
rather than attempting the full 80-section platform build in one pass.

**Client** now uses `SearchableSelect` + the existing `QuickAddContactModal<Customer>`
— no new backend code, since LIMS Client already reuses the `Customer`
model (per this ADR's own "What shipped" section).

**New reusable component**: `QuickAddCodeNameModal` (`apps/web/src/components/entities/`)
— for the many simple `{code, name}` catalog entities across every
industry profile (not just LIMS), parameterized by endpoint/queryKey/
title exactly like `QuickAddContactModal`. Code is auto-derived from
the typed name and shown read-only (e.g. typing "Groundwater" shows
"Code: GROUNDWATER" live) rather than asked for as a separate field —
the platform's "capture minimum viable master data now" principle.
Sample Type and Container both use it today; it's generic enough to
reuse for Unit, Payment Method, or any other industry's simple
reference catalogs without a new bespoke component per entity.

**Deliberately NOT built in this pass** (real, later gaps from the
80-section spec, not silently approximated): backend duplicate
detection (quick-add still POSTs straight to the normal endpoint, same
as the pre-existing Customer/Supplier quick-add already did — no
regression, but no new capability either), audit provenance
(`source_module` / "created via quick_create from Sample Registration"
is not recorded anywhere yet), a config-driven Quick Create Registry
(each entity still gets its own small parameterized component, not a
registry that auto-configures from an entity's schema), and Tests'
multi-select quick-add (per the spec's own §50 example, creating a Test
inline should also auto-add it to the sample's selected-tests list —
not wired in this pass).

**Verification**: `tsc --noEmit` and `vite build` both clean; existing
`tests/test_laboratory.py` suite (12 tests) still passes unchanged (no
backend touched this pass). Live-verified against the running
`docker-compose` stack via headless Chromium/CDP: opened Register
Sample, searched Client for a name that doesn't exist ("No clients
match."), clicked "+ Quick Add Client" — a nested dialog opened
correctly on top of the still-open Register Sample dialog (Radix's
portal + shared z-50 stacking works cleanly for one level of nesting,
no visual chaos), filled just a name, submitted — the nested dialog
closed, a "Client created and selected / ABC Water Testing Lab" toast
appeared, and the Register Sample dialog's Client field showed the new
client selected while every other field (Sample Type, Container,
Priority, Tests) remained exactly as before — the "search → not found
→ create here → auto-select → continue workflow" loop end-to-end, never
leaving the dialog. Repeated for Sample Type (typed "Groundwater",
watched the code preview update live, submitted, confirmed "Sample
Type created and selected" and auto-selection). Confirmed pre-existing
records (a client and sample type created directly via the API) still
appear correctly in the same searchable pickers alongside the newly
quick-created ones, with code shown as the sublabel — the migration
from plain `<select>` didn't regress normal search/select behavior.
