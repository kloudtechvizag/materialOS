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
