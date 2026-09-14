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

- **Worksheets / batch testing** — results are entered one test order
  at a time, not grouped into an electronic worksheet (§15).
- **Instrument integration** — no ASTM/HL7/FHIR adapter framework, no
  `LabInstrument`/`LabInstrumentInterface` tables (§21-23). Results are
  always manually entered.
- **Chain of custody as its own ledger, storage hierarchy, aliquot
  genealogy** (§8-10) — a sample has one `received_datetime` and no
  location/movement tracking.
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
worksheet level.** The spec's real intent (§67) is that a failed QC
run blocks release for *the batch of samples run alongside it* on one
worksheet. Since Worksheets don't exist yet, that scoping isn't
buildable honestly. The substitute shipped here is coarser but still
real: `authorize_result` checks the single *most recent* `QcRun` for
that result's test definition, of any type (blank/control/duplicate).
A fail blocks authorization (409) until a fresh run for that same test
passes. No QC run ever recorded for a test does not block — a lab that
hasn't configured QC for a given test yet isn't bricked by this
feature. This is documented as a real, later-visible gap (QC-per-
worksheet-batch, not QC-per-test-definition) in the model's own
docstring, not silently approximated.

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

**Deliberately still not built**: Levey-Jennings charts (§65),
Westgard multi-rule statistics (§66), and QC scoped to a worksheet's
batch of samples rather than a test definition's most recent run — all
named above, not approximated.

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
authorize it: the Sample Detail page surfaced the exact QC-block error
message ("This test's most recent QC run failed...") while the most
recent run was a fail, and authorization succeeded immediately after a
fresh passing run was recorded — the same 409-then-200 sequence proven
in the backend test, reproduced live end-to-end. The sidebar's
Laboratory section correctly shows the new "Quality control" nav item
alongside Samples and Test catalog.

## Reversibility

Fully additive across both passes: four migrations total (domain
tables, permission backfill, QC tables), one service/router/schema
module extended twice, one industry profile entry, four frontend
routes, and three nav items gated on the `laboratory` module. None of
it touches any existing table, endpoint, or profile. Removing it means
dropping the four migrations and the industry-profile entry — no other
domain depends on `lab_*` or `qc_*` tables.
