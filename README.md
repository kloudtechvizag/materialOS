# MaterialOS

AI-powered building materials business operating system. See
[`MaterialOS_Master_Brief_v2.md`](MaterialOS_Master_Brief_v2.md) for the
product brief this build follows (it supersedes `dev.md`, the original
116-section v1 prompt, which is kept as the full feature backlog).

**Status:** Slices 0-4 and 6 are built and working end to end (Slice 5, the
AI assistant, was explicitly skipped for now -- see the brief's Part F).
A separate, later-stage effort is turning the platform multi-industry via
an **Industry Profile Engine** (see ADR-010): the engine itself
(`IndustryProfile` catalog, dynamic sidebar/dashboard/item-attribute
rendering) is done, Building Materials is formalized as its first
profile with no regression, and two proof profiles are built end-to-end
-- **Retail** (a new POS/walk-in-sale module: barcode search -> cart ->
split cash/UPI/card payment -> real invoice + journal + stock deduction)
and **Pharmacy** (`Batch.expiry_date`, a near-expiry report/dashboard
widget, and pharmacy-specific item attributes via the same dynamic
attribute engine -- FEFO *enforcement* at the picking level is honestly
scoped out for now, see ADR-010's addendum for why). The industry
picker at signup and an Industry Configuration settings page (view the
active profile, switch to a different one -- a single FK write, no data
migration) are done too. All **23 industries** from the original brief
(the 22-item list plus Building Materials) are now defined and selectable
-- confirmed cheap to add as plain `PROFILE_DEFINITIONS` entries, no
migration or new code, per ADR-010's second addendum. Two of them
(Travel, Real Estate) are honestly scoped to generic sales/accounting
only, no inventory/POS -- they're project/booking businesses, not
inventory-item ones, and their real domain models aren't built.
A 24th profile, **Printing Press & Digital Color Lab** (see ADR-011),
is the one industry that genuinely needed new code rather than a config
entry: a real `PrintJob`/`PrintJobArtwork`/`PrintMachine` schema, a
production Kanban board, and an artwork-approval gate that actually
blocks production on an unapproved version -- live-verified end to end
(job created → blocked → artwork uploaded → still blocked → approved →
production → costed → invoiced with a real journal and media stock
deduction → job profitability). Everything reusable was reused (paper/
ink as ordinary Items, outsourcing via Supplier, billing via Invoice);
what wasn't built (an N-up costing formula, RIP integration, AI
production planning, customer-portal artwork upload) is named as such
in ADR-011, not approximated.

- **Slice 0** (Foundation + Tally/Busy migration): signup, auth, RBAC,
  RLS-isolated tenancy, document numbering, the audit trigger, and the
  six-step Tally/Busy import pipeline.
- **Slice 1** (Sell and stock): the golden transaction -- quote → credit
  check → approve → sales order → reserve stock → dispatch → invoice →
  part-payment → outstanding updated → project profitability -- runs for
  real, with a balanced double-entry journal posted underneath (minimal
  chart of accounts; full accounting statements are Slice 4) and GST
  split correctly into CGST+SGST or IGST by place of supply.
- **Slice 2** (Godown and dispatch): a dispatch board, vehicle/driver/trip
  assignment, proof-of-delivery capture (signature + photo + GPS,
  mobile-web rather than a native app -- see ADR-005) that closes the
  trip and updates the dispatch board with no paper challan, warehouse
  transfers, blind stock counts with variance approval posting a real
  ledger adjustment, and sales returns that reverse both stock and the
  journal.
- **Slice 3** (Buy and collect): Purchase Order → approve → Goods Receipt
  (with per-line QC) → landed cost allocation (by value or quantity,
  folded into `Item.standard_cost` -- see ADR-006) → Purchase Bill (GST
  split the same way Slice 1 does for sales) → Supplier Payment, all with
  a Supplier 360. The collections module computes real ageing buckets and
  DSO from posted invoices -- this is the number Slice 3's acceptance
  test tracks -- plus a plain, explainable (not AI-branded) collection
  priority list. Field sales check-in is mobile-web, same reasoning as
  ADR-005. WhatsApp send (quote/invoice/statement/receipt) is explicitly
  not built: it needs real Meta WhatsApp Business API credentials this
  environment doesn't have, not a fake button.
- **Slice 4** (Books and compliance): a real chart of accounts with cost
  centres, general ledger / trial balance / P&L / balance sheet / cash
  flow computed straight from the journal (nothing double-maintained),
  GSTR-1 (B2B, B2CS, CDNR, HSN summary) and GSTR-3B data extracts, and
  a Tally export adapter symmetric to Slice 0's importer. E-invoice
  (IRN) and e-way bill generation both work end to end against a real,
  deterministic sandbox gateway with the 180-day and 24-hour rules
  enforced -- the *live* GSP/NIC gateways are structurally complete but
  refuse to run until real credentials are configured, rather than
  faking success on a legally-binding document (see ADR-007). Balance
  sheet equity is a computed plug and cash flow has no investing/
  financing sections, both because no transactions exist yet to justify
  more than that (ADR-008).

- **Slice 6** (Customer ecosystem): a customer-portal login
  (`User.customer_id`, scoped by `deps.get_portal_customer` -- never by
  RBAC permissions, see ADR-009) lets a customer view and approve/reject
  their own quotations, track orders/deliveries, see a running-balance
  statement, upload a PO against a quotation, and submit a payment
  intimation that posts a real `Receipt` the same way staff-recorded
  payments do (it is not a payment gateway -- no gateway credentials
  exist here, same reasoning as ADR-007's GSP/NIC gap). A generic,
  table-driven approval workflow (`ApprovalRule`/`ApprovalRequest`) has
  one real call site today: a sales order blocked by B25's credit-limit
  check opens a pending approval instead of only failing, and an approved
  request lets the same order creation succeed on retry, visible on the
  staff-facing Approvals page. An in-app (not push/email/WhatsApp)
  notification centre backs both the approval workflow and portal events;
  it's tenant-wide rather than per-user because no salesperson/customer
  assignment model exists yet to target one user. See ADR-009 for the
  full reasoning and what's deliberately deferred.

Slice 5 (the AI assistant) is not started; see the brief's Part F for
what's next and why the order matters.

A **desktop app** (`apps/desktop`, see ADR-012) wraps this same web app
in a native Tauri shell for Windows/macOS/Linux -- no second frontend,
`apps/web`'s existing build output is what ships. A4/local printing
works today via the browser-standard `window.print()` (wired to
`InvoiceDetailPage`); barcode scanners already work with zero code
(they're keyboard-wedge HID devices, same as in any browser tab). Cash-
drawer raw ESC/POS control and offline-first sync are named as
deferred, not faked -- see ADR-012. **Not compiled in this dev
sandbox** (no root to install Tauri's Linux prerequisite system
libraries) -- `ci.yml`'s `desktop-check` job (compile-check, every
push) and `desktop-release.yml` (real Windows `.msi` + Linux
`.deb`/`.AppImage` installers, on `desktop-v*` tags or manual dispatch
-- macOS not included, not requested) do the actual verified build on
GitHub-hosted runners; ADR-012 has the detail on exactly how far local
verification got and why it stopped there.

**Backup, notifications, audit & platform operations** (see ADR-013)
are shared services every module and every industry profile uses, not
per-module features. Tenant-scoped logical backups (never a raw
`pg_dump`, since RLS is what makes a "backup" mean "this tenant's own
rows") run on demand or nightly via a Celery `beat` schedule, with a
real FK-topological-sort restore that excludes company/branch/
warehouse/user rows from the delete/re-insert cycle on purpose. The
notification rule engine has one real delivery channel today (email);
WhatsApp/SMS/push are named as deferred, same reasoning as ADR-007's
compliance-gateway gap, not faked. The audit log (populated by a DB
trigger since Slice 0) is now readable via `/audit-logs`, and
`/command-center` aggregates live system health plus backup/
notification/audit activity into the one operations screen the spec
asked for. Live-verified end to end against the running containers,
including two real bugs the unit suite didn't catch -- see ADR-013.

## Architecture

```
apps/
  api/      FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16, RLS-isolated per tenant
  web/      React + TypeScript (strict) + Vite + Tailwind + TanStack Query + Zustand
  desktop/  Tauri v2 shell around apps/web -- see ADR-012
docs/
  decisions/   ADRs -- read these before changing a locked decision
scripts/
  seed.py           Demo data (Sri Balaji Building Materials, Building
                    Materials profile): catalog, opening stock,
                    customers/suppliers, and a handful of quotations
                    walked through every real pipeline stage via the
                    actual service functions (no backdated/fabricated
                    history)
  seed_retail.py    Small Retail-profile demo tenant (Fashion Hub): a
                    few items + two real POS sales via create_walk_in_sale
  seed_pharmacy.py  Small Pharmacy-profile demo tenant (ABC Medicals):
                    a Medicines category with a real parameter_schema,
                    a few medicines with those attributes filled in,
                    and batches (one near-expiry, one not)
```

Money is `NUMERIC(18,4)` + Python `Decimal` end to end, never a float.
Tenant isolation is enforced by PostgreSQL row-level security, not by
application code -- see `docs/decisions` and Part B of the brief for the
full list of non-negotiable invariants and why each one is a database
constraint, not a convention.

## Running it

Requires Docker. Ports are non-standard to avoid clashing with other
projects on the same machine: API on `58000`, web on `5173`, Postgres on
`55432`, Redis on `56379`.

```bash
docker-compose -p materialos up -d db redis
docker-compose -p materialos up -d api worker beat web
```

`beat` runs the daily scheduled backup (ADR-013) -- `worker` alone
executes jobs handed to it but never triggers the schedule on its own.

Then either sign up a fresh workspace at http://localhost:5173/signup,
or load the demo tenant:

```bash
cd apps/api
DATABASE_URL="postgresql+psycopg://materialos_app:materialos_app_dev_password@localhost:55432/materialos" \
  python ../../scripts/seed.py
```

Demo login: `owner@sribalaji-demo.example.com` / `demo-password-123`
(workspace: `sribalaji-demo`). The same pattern with `seed_retail.py`
(`owner@fashionhub-demo.example.com`, workspace `fashionhub-demo`) and
`seed_pharmacy.py` (`owner@abcmedicals-demo.example.com`, workspace
`abcmedicals-demo`) demonstrates the Industry Profile Engine (ADR-010)
rendering a genuinely different sidebar/dashboard/item form per profile.

API docs: http://localhost:58000/docs

### Running the desktop app

Needs the Rust toolchain (`rustup.rs`) plus Tauri's Linux prerequisite
packages if developing on Linux
(https://tauri.app/start/prerequisites/ -- `libwebkit2gtk-4.1-dev` and
friends; not needed on Windows/macOS, which use the OS's built-in
WebView2/WKWebView). With the API running (above):

```bash
cd apps/desktop
npm install
npm run dev    # launches the app window, auto-starts apps/web's dev server
```

`npm run build` produces a real installer (`.msi`/`.dmg`/`.deb`/
`.AppImage` depending on platform) in `apps/desktop/src-tauri/target/release/bundle/`.
See ADR-012 for what desktop-specific capability exists today (local
printing) versus what's deferred (cash-drawer/scale device access,
offline-first sync) and why.

## Database migrations

Migrations run as the Postgres **superuser** role (`materialos`); the
API itself connects as a separate, unprivileged `materialos_app` role so
that row-level security actually applies -- Postgres superusers bypass
RLS unconditionally. See
`apps/api/alembic/versions/df0c4d3ffcbf_app_runtime_role_for_rls_enforcement.py`.

```bash
cd apps/api
MIGRATIONS_DATABASE_URL="postgresql+psycopg://materialos:materialos@localhost:55432/materialos" \
  alembic upgrade head
```

## Tests

```bash
cd apps/api
python -m venv .venv && .venv/bin/pip install -r requirements.txt
DATABASE_URL="postgresql+psycopg://materialos_app:materialos_app_dev_password@localhost:55432/materialos" \
  .venv/bin/python -m pytest -q
```

Tests run against a real Postgres instance, not mocks or SQLite --
several of the invariants in Part B (row-level security, concurrent
document numbering, gapless numbering under contention) are only real
under a real database engine.

## Decisions already made

Recorded in `docs/decisions/`:

- **ADR-001**: MaterialOS and nirmaanOS are separate products sharing
  nothing, for now (Option A from the brief's §A5).
- **ADR-002**: Slice 0 opening balances/stock use a minimal signed field
  and a real-but-minimal stock ledger, not the full journal/batch/bin
  machinery that belongs to Slices 1 and 4.
- **ADR-003**: item parameters (grade, diameter, heat number, ...) are
  stored as `Category.parameter_schema` + `Item.attributes` JSONB, not
  full EAV tables.
- **ADR-004**: Slice 1's tax module reads the GST rate straight off
  `Item.gst_rate` rather than an effective-dated rate table -- the
  `resolve_tax()` interface already matches Slice 4's eventual shape.
- **ADR-005**: Slice 2's driver-facing flows (today's deliveries, POD
  capture) ship as a mobile-responsive web page, not the React Native
  app Part E specifies -- same API either way, so swapping in a native
  app later changes nothing server-side.
- **ADR-006**: `Item.standard_cost` is "latest landed cost" (each goods
  receipt overwrites it), not weighted-average or FIFO -- no new state,
  matches how an owner actually prices day to day.
- **ADR-007**: e-invoice/e-way bill live gateways raise `NotConfiguredError`
  until real GSP/NIC credentials are set; only the sandbox gateway runs
  otherwise. A fake "live" success response on a compliance document is
  a bigger risk than an honest refusal.
- **ADR-008**: the balance sheet's equity is `Assets - Liabilities`,
  computed on read, not a posted account -- no capital/drawings
  transactions are modeled yet. Cash flow is a flat cash-movement list
  by document type, not a labelled operating/investing/financing
  statement, since the latter two sections don't exist to be empty.
- **ADR-009**: Slice 6's notifications are tenant-wide, not per-user (no
  assignment model exists yet); portal payment is a `Receipt`-creating
  intimation, not a gateway charge (no gateway credentials exist, same
  reasoning as ADR-007); and the generic approval workflow has exactly
  one real trigger today (B25's credit-limit check on sales orders) --
  more `trigger_type`s are additive rows plus one call site each, not a
  schema change.
- **ADR-010**: the Industry Profile Engine's `IndustryProfile` is a
  platform-level catalog (no `tenant_id`, no RLS), seeded like
  `Permission`; only `building_materials` has a migration (it also
  backfills pre-existing companies), every other profile -- all 23,
  confirmed by adding the remaining 20 in one pass, no migration or
  code change needed -- is a plain `PROFILE_DEFINITIONS` entry; a
  company can switch to a different whole profile (single FK write, no
  data migration) but there's no per-*module* override within a profile
  yet; Travel/Real Estate are honestly scoped to sales/accounting only
  (no inventory/POS) since they're project/booking businesses, not
  inventory-item ones; `terminology` is stored and shown on the
  Industry Configuration page but not yet consumed anywhere else (nav
  labels, entity page headers) -- that wiring is still open, not done.
- **ADR-011**: Printing Press is the one profile backed by real new
  tables (`PrintJob`/`PrintJobArtwork`/`PrintMachine`), not a config
  entry -- the spec driving it is explicit that a print shop is a
  job/production business, not products-in-a-cart. Everything reusable
  was reused (media/paper as ordinary `Item`s, project-based printing
  via `Project`, outsourcing via `Supplier`, billing via
  `Invoice`/the journal); an N-up costing calculator, RIP/color-
  management integration, AI production planning, and customer-portal
  artwork upload are named as deferred, not faked. The one explicitly-
  required rule -- production blocked until the latest artwork version
  is approved -- is actually enforced in `update_job_status()`, not
  just documented.
- **ADR-012**: the desktop app (`apps/desktop`) is a Tauri v2 shell
  around `apps/web`'s existing build output, not a second frontend.
  Real capability: `window.print()` for A4/local printing (a standard
  web API, zero Tauri plugin code) and barcode scanners (already work,
  zero code -- they're keyboard-wedge HID devices). Deferred: raw
  ESC/POS cash-drawer control, weighing-scale device access, offline-
  first sync. Not locally compiled in this dev sandbox (no root for
  Tauri's Linux system-library prerequisites) -- `rustup`/`cargo`
  install and resolve real dependencies before hitting that wall, and
  the actual verified compile/link/bundle happens in CI
  (`desktop-check` on every push, full installer builds in
  `desktop-release.yml` on tagged releases), which is also how most
  real Tauri projects ship anyway.
- **ADR-013**: backup/recovery, notifications, audit, and system health
  are shared platform services, not per-module features. Backups are
  tenant-scoped logical dumps (RLS filters the `SELECT`s), never a raw
  `pg_dump`; restore uses a real FK-topological sort (`pg_constraint`,
  not the privilege-restricted `information_schema` view) and never
  touches `companies`/`branches`/`warehouses`/`users`/roles. The
  notification rule engine has one real delivery channel (email) with
  WhatsApp/SMS/push deferred for the same "no fake credentials" reason
  as ADR-007; failed deliveries land as visible, manually-retryable
  dead letters rather than vanishing. Audit log exposure required no
  new capture code (the DB trigger has run since Slice 0) -- only new
  read endpoints. `GET /command-center` aggregates all of the above
  into the one operations screen the spec asked for. Two real bugs
  (an `information_schema` privilege gap, and two permission codes
  never seeded into the catalog) were caught only by calling the live
  endpoints against the running containers, not by the unit suite --
  see the ADR for both.

Read these before re-litigating any of them.
