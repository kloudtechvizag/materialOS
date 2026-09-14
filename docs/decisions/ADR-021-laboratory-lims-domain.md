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
- **QC subsystem** — no control samples, Levey-Jennings charts,
  Westgard rules, or QC-gated result release (§19).
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

## Verification

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

## Reversibility

Fully additive: two new migrations (domain tables + permission
backfill), one new service/router/schema module, one new industry
profile entry, three new frontend routes, and two new nav items gated
on the `laboratory` module. None of it touches any existing table,
endpoint, or profile. Removing it means dropping the two new
migrations and the industry-profile entry — no other domain depends on
`lab_*` tables.
