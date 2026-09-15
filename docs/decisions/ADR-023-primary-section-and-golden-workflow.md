# ADR-023: Primary-section sidebar ordering + per-profile dashboard workflow

**Context:** a scoped request asked for two related fixes to how the
app communicates "this is YOUR business" (the same framing ADR-010's
industry-profile engine and ADR-022's nav-gating fixes already build
toward):

1. **Sidebar ordering** — for a profile with its own dedicated section
   (Laboratory, Printing), that section should sit directly under
   Dashboard/Approvals, ahead of cross-cutting sections (People &
   Payroll, Operations, Setup) that exist for every business
   regardless of industry. Before this, `ALL_NAV_SECTIONS`' fixed
   declaration order put People & Payroll ahead of Laboratory for a
   lab tenant (verified live: `Dashboard | Approvals | Overview |
   Employees | ... | Samples | Test catalog | ...`), which reads as
   "this is an HR system that also happens to do lab work."
2. **Dashboard "golden transaction"** — `DashboardPage.tsx`'s "Start
   the golden transaction" card was 100% hardcoded JSX: `New quotation
   → approve → sales order → dispatch → invoice → payment`, for every
   one of the 25 industry profiles, including Laboratory (which has no
   Quotation/SalesOrder capability at all — `enabled_modules:
   ["laboratory"]`, confirmed in ADR-021). A lab tenant's dashboard
   pointed at a workflow with zero relationship to what that tenant
   actually does.

## What shipped

**Sidebar ordering** (`lib/navigation.ts`): a new
`PRIMARY_SECTION_BY_MODULE` map (`{laboratory: "laboratory", printing:
"printing"}`). `buildNavigation()` filters as before, then — if the
active profile's `enabled_modules` includes one of these keys — splices
that one section to the front of the already-filtered, already-ordered
list. Every other profile (23 of 25) has no single section that plays
this "primary domain" role — Sell/Buy/Dispatch/Books together form
their workflow, not one section — so their relative order is untouched,
exactly as `ALL_NAV_SECTIONS` declares it.

**Dashboard golden workflow**: a new `IndustryProfile.golden_workflow`
JSONB column (migration `d6e7f8a9b0c1`), same shape as
`dashboard_widgets`/`terminology`/`enabled_modules` — real per-profile
configuration, not a second `if industry == "..."` branch through the
app. Shape: `{cta_label, cta_href, steps: string[]}`. Populated with
real, working values for the two profiles whose actual transaction
shape differs from the generic trade flow:

- **Laboratory**: `Register sample → Run tests → Generate report →
  Sign off`, CTA to `/lab/samples` (real route, real dialog, proven
  live in ADR-021's own verification).
- **Printing**: `New print job → Production → Finishing → Dispatch →
  Invoice`, CTA to `/print-jobs` (same).

The other 23 profiles keep `golden_workflow: {}` (via the column's
`server_default`, no per-row backfill needed) — `DashboardPage.tsx`
reads that as "no bespoke override, use `DEFAULT_GOLDEN_WORKFLOW`" (the
same quotation-to-payment flow that was hardcoded before, now
centralized in one named constant instead of inline JSX). This is a
**deliberately different empty-value semantic** than
`dashboard_widgets: []`, which laboratory itself uses to mean "show no
widget cards at all" (ADR-021: "left empty rather than padded with
generic ERP widgets a lab dashboard has no real use for"). For
`golden_workflow`, empty doesn't mean "show nothing" — the generic
trade flow is still real, working infrastructure (Quotation,
SalesOrder, Dispatch, Invoice, Payment all genuinely exist), so hiding
it for 23 profiles that have always shown it and still legitimately
can would be a regression, not a fix. Documented explicitly in both the
model's own comment and `DashboardPage.tsx`'s comment so the asymmetry
reads as intentional, not inconsistent.

**Both features share their re-render mechanism for free**: `SidebarNav`
and `DashboardPage` already both call `useIndustryProfile()`, which is
just a `useQuery(["companies"])` read — no new state plumbing was
needed. `IndustryConfigPage`'s profile-switch mutation already
invalidated that exact query key (pre-existing code, unrelated to this
ADR), so both the sidebar and the dashboard were already wired to
re-render automatically on a profile switch; this ADR only needed to
make sure what they render responds correctly to the data, not to build
the re-render plumbing itself.

## Deliberately NOT built in this pass

- **A distinct "Services" workflow** (technician assignment, service
  request → complete job → invoice) — no real backend entity for this
  exists anywhere in the codebase (no `ServiceRequest`/`Technician`
  model). Fabricating a CTA pointing at a route that doesn't exist
  would be exactly the kind of fake functionality this project
  consistently avoids; named here as a real, later gap instead.
- **Bespoke `golden_workflow` values for the other 23 profiles** — the
  shared default is still real and accurate for a trade/dealer
  business (which is what most of them are); a POS-centric flow for
  the 9 POS-enabled profiles (retail, pharmacy, food_beverage, mobile,
  garments, jewellery, stationery, electronics, grocery) would be a
  legitimate future refinement, not attempted here to keep this change
  scoped to what was asked and verified.

## Verification

2 new backend tests (`test_industry_profile.py`) —
`golden_workflow` round-trips correctly through both `GET
/industry-profiles` and `GET /companies` for a real signed-up tenant;
laboratory and printing_press have their real values, building_materials
and retail correctly default to `{}`. Full suite: 217 passed, zero
regressions. Frontend `tsc --noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium: a laboratory tenant's sidebar shows `Dashboard | Approvals |
Laboratory | ...` (Laboratory directly under Approvals, not buried
after People & Payroll) and its dashboard shows "Register sample →
Run tests → Generate report → Sign off" with a working `/lab/samples`
link; a printing tenant's sidebar shows Printing first and its
dashboard shows "New print job → Production → Finishing → Dispatch →
Invoice"; a Building Materials tenant's dashboard still shows the
original "New quotation → Approve → Sales order → Dispatch → Invoice →
Payment" unchanged, proving the default path wasn't broken. Then, in
one continuous session (no reload), switched a live tenant from
Building Materials to Laboratory via the real Settings → Industry
page: the sidebar reordered and the dashboard workflow changed
immediately, in place — confirmed via both screenshot and a DOM text
read taken before any navigation occurred, proving the automatic
re-render requirement genuinely holds rather than only working after a
fresh page load.

## Reversibility

Fully additive: one new JSONB column with a server-side default (every
existing row keeps working with `{}`), two rows given real values, one
new frontend constant (`DEFAULT_GOLDEN_WORKFLOW`), one new frontend
map (`PRIMARY_SECTION_BY_MODULE`), and the existing hardcoded JSX
replaced with a read from config. No existing endpoint signature,
route, or migration touched. Removing it means reverting
`DashboardPage.tsx` to the hardcoded card, removing the splice logic
from `buildNavigation()`, and dropping the `golden_workflow` column —
no other code depends on either existing.

## Addendum: Building Materials (and every other warehouse-based
## trader) gets its own primary section

**Context:** a follow-up request asked specifically about Building
Materials' sidebar: its core stock operations (items, warehouses,
batches, stock movement) were scattered across generic Setup/Dispatch
sections instead of leading the sidebar the way this ADR's own
Laboratory/Printing sections already do for their profiles. Two real,
pre-existing bugs surfaced during investigation, both instances of the
same class this ADR's base pass already fixed once (ADR-022's "six
ungated nav items" addendum, in the opposite direction — there it was
items showing where they shouldn't; here it's modules that show
nowhere at all):

1. **`warehouse` was an orphan module.** It's a real, valid
   `IndustryProfile.enabled_modules` key (8 profiles have it: building
   materials, ecommerce, fmcg, auto parts, chemical, electrical, paper
   mill, paint — genuine B2B distributors/manufacturers), it appeared
   as an "Enabled modules" badge on `/settings/industry`, and it gated
   **zero** sidebar items. Toggling a profile's warehouse capability on
   or off had no visible effect anywhere.
2. **No frontend page existed for Warehouses, Batches, or Stock
   movements**, even though the backend already had real, working
   infrastructure for all three: `GET /warehouses` (list-only --
   `POST` didn't exist either), `GET/POST /batches`
   (`models/catalog.py`'s `Batch`, with steel's own `heat_number`
   column), and `StockLedger` (`models/inventory.py`, append-only,
   already written by every purchase/sale/transfer/adjustment) with no
   read endpoint at all.

## What shipped

**A new "Inventory & Trading" primary section** (`lib/navigation.ts`),
containing the relabelable Item catalog (same terminology-driven
relabeling every other profile's own copy gets — "SKUs" for FMCG,
"Items" for building materials), Warehouses, Batches, and Stock
movements — all gated on `module: "warehouse"`. `PRIMARY_SECTION_BY_MODULE`
gained `warehouse: "inventory-trading"`, so it promotes to the top
(under Dashboard/Approvals) for exactly the 8 profiles that enable it,
the same mechanism Laboratory/Printing already use — not a new,
profile-slug-based gating system, which would have duplicated
`enabled_modules`' own job. `GENERIC_ITEMS_HOME_MODULES` gained
`"warehouse"` so Setup's generic Items entry correctly disappears for
these profiles instead of duplicating the new section's own copy.
Retail/pharmacy/grocery and the other 16 profiles without `warehouse`
are untouched -- their own counter/storefront stays the primary
interaction, exactly as this ADR's base pass already reasoned.

**The existing Sell/Dispatch/Buy/Books sections were relabeled and
Sell+Dispatch merged**, since the request's ask for "SALES & DISPATCH,
PROCUREMENT & BUYING, FINANCE & BOOKS instead of unorganized
single-action headers" applies to the shared section registry, not
something building-materials-specific: `sell` + `dispatch` merged into
one `sales-dispatch` section ("Sales & Dispatch"), `buy` relabeled
"Procurement & Buying", `books` relabeled "Finance & Books". This
changes every profile's labels, not just building materials' --
intentional, since these are the same generic sections every non-
Laboratory/Printing/warehouse profile already shares, and the old
one-word headers had the exact "unorganized single-action headers"
problem the request named.

**Two small, real backend additions**, both read/write against
infrastructure that already existed and was already tested elsewhere,
not new domain logic:
- `POST /warehouses` (`warehouses.create`, mirrors `POST /branches`'s
  existing shape exactly) -- the list endpoint existed, create didn't.
- `GET /stock-ledger` (`stock.view`, optional `item_id`/`warehouse_id`
  filters, newest first, capped at 500 rows) -- the first read endpoint
  over `StockLedger`, which every transaction already writes to.

**Three new, minimal frontend pages** (`routes/inventory/`):
`WarehousesPage` (list + create, mirrors `BranchesPage.tsx`'s existing
pattern), `BatchesPage` (list + create batch/lot codes, expiry, heat
number -- explicitly does **not** claim to track a quantity per batch,
since no such column exists), `StockMovementsPage` (read-only, item/
warehouse filters). "Weight tracking" from the request's own "Weight &
Batch Tracking" phrasing was **not** built as a distinct feature:
`IndustryProfile.inventory_flags.weight_tracking` is a real, declared
per-profile flag (building materials has it `true`), but grep confirms
it gates zero behavior anywhere in the app today -- it's already
informational-only on `/settings/industry`, same as `batch_tracking`/
`fefo`/`expiry_tracking`. Building a page for a flag with no backing
behavior would be exactly the fake functionality this project avoids;
the honest fix was naming the new page "Batches" (what's real) rather
than "Weight & Batch Tracking" (what was asked but isn't backed).

**Dynamic re-render** (the request's other ask) needed no new work --
ADR-023's base pass already made the sidebar and dashboard both read
`useIndustryProfile()` live off the `["companies"]` query, and
`IndustryConfigPage`'s switch mutation already invalidates it. Re-
verified rather than rebuilt: switching a live tenant from Building
Materials to Retail to FMCG, in one continuous session, correctly
showed Inventory & Trading disappear (Retail has no `warehouse`
module) then reappear with FMCG's own "SKUs" label -- no page reload
between switches.

**A real regression guard for the orphan-module bug class**
(`apps/web/scripts/check-nav-module-coverage.mjs`, run via `npm run
check:nav-modules`): loads the real `NAVIGATION_CONFIG` through Vite's
own SSR module graph (same technique `scripts/prerender.mjs` already
uses, so it can't drift from what the app actually renders) and fails
if any module in `VALID_MODULES` gates zero sidebar items, except an
explicit, commented `ALLOWED_ORPHANS` list. Today that list holds
exactly one entry: `credit` (`Customer.credit_limit`/`credit_days` are
real fields already shown on the always-visible Customers/Customer 360
pages -- the capability exists, it's just not a distinct menu section).
No pytest equivalent was added because `apps/web` isn't mounted into
the API container this project's tests already run inside (confirmed
directly), so a Python-side check couldn't actually read
`navigation.ts`; this stays a Node script, mirroring how `tsc`/`vite
build` are already this project's frontend-side validation instead of
being ported into pytest.

## Deliberately not built in this pass

- **Per-company module override toggles.** The request described
  "toggles under Enabled Modules" controlling visibility in real time;
  today `enabled_modules` is entirely inherited from the tenant's
  `IndustryProfile` (whole-profile switch, already real-time per the
  base ADR) with no per-company override column. Building one is a
  genuine, separate schema+resolution-precedence feature, not a
  sidebar fix -- flagging it here rather than shipping a toggle UI that
  writes to a field that doesn't exist. What already works today: any
  module the *active* profile enables immediately shows its nav items,
  and switching profiles changes that set instantly (verified above).
- **Real quantity-per-batch tracking, and FEFO-aware picking off
  `StockMovementsPage`.** Both are `Batch`/`StockLedger` schema and
  service-layer work, not a sidebar/page-wiring task.

## Verification

Full backend suite: 219 passed, zero regressions (two new endpoints,
no existing ones touched). `tsc --noEmit` and `vite build` clean.
`npm run check:nav-modules` passes, and was verified to actually catch
a regression (temporarily reintroducing an ungated fake module made it
fail with exit code 1, as designed). Live-verified against the running
`docker-compose` stack via headless Chromium: a fresh Building
Materials tenant's sidebar reads exactly `Dashboard | Approvals |
Inventory & Trading (Items, Warehouses, Batches, Stock movements) |
Sales & Dispatch | Procurement & Buying | Finance & Books | People &
Payroll | Operations | Setup`; `/warehouses` shows the branch's
auto-seeded default godown and a working create form; `/stock-ledger`
renders its empty state and filters correctly. Then, in one continuous
session, switched Building Materials → Retail (Inventory & Trading
correctly vanished, Setup's Items reappeared as "Products") → FMCG
(Inventory & Trading correctly reappeared, this time labeled "SKUs") --
all confirmed via a DOM text read of the live sidebar, not just
screenshots, with no page reload between switches.

## Addendum: Items/Customers/Branches/Projects never belong in Setup

**Context:** a direct follow-up named the previous addendum's own
oversight: the new Inventory & Trading section carried Items,
Warehouses, Batches, and Stock movements, but **Customers and
Branches were still universally declared inside Setup** (ungated,
shown for every one of the 25 profiles), alongside a still-Setup-
resident "Projects" item that had no dedicated section at all. Setup
mixed genuine system configuration (Users, Webhooks, Subscription)
with core transactional entities -- the request's own framing
("SETUP strictly contains system-level configuration") names exactly
the gap.

## What shipped

**Setup, cleaned to its stated allowlist**: Users, Company settings,
Industry, Subscription, Capabilities, Receipts, Webhooks, Support,
Import from Tally/Busy. `items`, `customers`, `branches`, and
`projects` were removed from its declaration entirely -- not hidden by
a filter, deleted from the section's own item list, so there's no
code path left that could ever render them there.

**A new `projects-services` section** ("Projects & Services"),
containing `Projects` plus its own module-gated copies of
Items/Customers/Branches -- the third dedicated domain section
alongside Laboratory and Inventory & Trading. `PRIMARY_SECTION_BY_MODULE`
gained `projects: "projects-services"`, promoting it to the top for
Furniture and Real Estate specifically -- the only two profiles where
`projects` is enabled without `warehouse` or `printing` also winning
first (`Array.prototype.find` walks each profile's own
`enabled_modules` in order, so Building Materials and Electrical, which
enable *both* `warehouse` and `projects`, deterministically land on
Inventory & Trading -- exactly what the request's own categorization
asked for).

**Items/Customers/Branches now resolve to exactly one section per
profile, never zero, never two**: `OPERATIONAL_ENTITY_IDS` names the
three; `buildNavigation()` resolves one `entityHomeSectionId` per
profile up front (the profile's own primary domain section if it has
one, else the generic `sales-dispatch` section every profile without a
dedicated domain already leads with -- "the core domain block
immediately following Approvals" the request asked for) and drops
every *other* section's copy of the three, even when that other
section's own module also happens to be enabled. This is what actually
required the dedup to move: naively module-gating a copy in each of
Laboratory/Printing/Inventory & Trading/Projects & Services would have
shown Items/Customers/Branches **twice** for Building Materials (both
`warehouse` and `projects` enabled) and for Electrical (same) and for
printing_press (`printing` and `projects` both enabled) without it.
Laboratory and Printing needed their own copies for a second, sharper
reason, not just tidiness: neither profile has a `sales` module at
all (`PROFILE_DEFINITIONS`), so the generic `sales-dispatch` fallback
section doesn't exist for them -- their own domain section is the
*only* place these three entities could possibly live.

## Deliberately not built in this pass

- **Per-profile choice of which entities relocate where beyond the
  three named** (Items, Customers, Branches). The request also named
  Projects, which already had exactly one home (`projects-services`,
  gated on its own `projects` module) and didn't need the dedup
  treatment since it's domain-specific rather than a cross-cutting
  entity like the other three.
- **Metal rates** (jewellery's Setup entry) was left exactly where it
  is -- the request named four entities to relocate (Items, Customers,
  Projects, Branches) and gave an explicit Setup allowlist that neither
  includes nor excludes it by name; moving it wasn't asked for, so it
  wasn't touched.

## Verification

Full backend suite: 219 passed (this addendum is frontend-only, so
this mainly confirms nothing else regressed). `tsc --noEmit` and `vite
build` clean. `npm run check:nav-modules` still passes (the `projects`
module now gates real sidebar items via `projects-services`'s own
copies, in addition to the pre-existing `Projects` item).

Live-verified via headless Chromium across the four cases that
actually exercise the dedup logic differently:
- **Building Materials** (`warehouse` + `projects` both enabled):
  sidebar reads `Inventory & Trading (Items, Customers, Branches,
  Warehouses, Batches, Stock movements) | Sales & Dispatch | ... |
  Projects & Services (Projects only, no duplicated entities) | ...`
  -- confirming the dedup picks exactly one winner.
- **Furniture** (`projects` only, no `warehouse`): `Projects & Services
  (Projects, Items, Customers, Branches)` promoted to the very top.
- **Laboratory** (no `sales` module at all): `Laboratory` section
  itself now carries `Reagents & Supplies` (relabeled Items),
  Customers, and Branches, since no Sales & Dispatch fallback exists
  for it to fall back to.
- **Retail** (no dedicated domain): `Sales & Dispatch` leads with
  `Products` (relabeled Items), Customers, Branches, ahead of Leads/
  POS/Quotations.

Every one of the four Setup sidebars was confirmed to contain exactly
the allowlisted system-configuration items and nothing else. Clicking
through to `/projects` and `/customers` from their new locations
confirmed the routes themselves (unchanged) still render and highlight
correctly under their new section.
