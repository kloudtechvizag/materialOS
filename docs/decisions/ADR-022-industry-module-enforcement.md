# ADR-022: Industry-exclusive module enforcement (backend + route guard)

**Context:** a 37-section master prompt asked for a full "one active
business profile per company" architecture — registration-time visual
profile picker, profile-driven navigation/dashboard/terminology
(already exists per ADR-010), backend + frontend enforcement so a
company can't reach another industry's features even via direct
URL/API access, a company switcher for users owning multiple
businesses, and a confirmation-gated "change profile" settings flow.

Before writing any code, the prompt's central claim was audited
against the real codebase rather than assumed: **the claim that the
sidebar shows multiple unrelated industries' sections simultaneously
is false today.** `buildNavigation()` (`apps/web/src/lib/navigation.ts`)
already filters nav items by `IndustryProfile.enabled_modules`, and
every industry-exclusive module (`laboratory`, `printing`) is used by
exactly one profile — verified against every profile definition in
`services/industry.py`, and against this session's own live screenshots
of a laboratory tenant's sidebar, which never showed a Printing section.

What the audit found instead were two real, concrete enforcement gaps,
plus one already-solved item and one large unbuilt item, named
separately below rather than conflated:

- **Backend**: `require_permission()` (`app/deps.py`) checks only
  role-permission grants, with zero awareness of the tenant's active
  `IndustryProfile.enabled_modules`. Industry-exclusive permission
  resources get backfilled onto *every* tenant's `owner` role whenever
  introduced (see `b8c9d0e1f2a3_backfill_laboratory_permissions.py`'s
  own docstring: "grants them to every tenant's is_system owner role")
  — meaning a Printing-profile tenant's owner genuinely had
  `laboratory.*` permissions and could call `/api/v1/lab/*` by URL
  alone, UI hiding the link notwithstanding.
- **Frontend**: no route guard existed anywhere — `App.tsx`'s routes
  rendered unconditionally regardless of `enabled_modules`; only the
  sidebar link was hidden, not the route.
- **Already solved, not attempted here**: `IndustryConfigPage.tsx`
  already implements "current profile + change profile" (a
  `/companies/{id}/industry-profile` PATCH) with explanatory text
  about what changes and what's preserved — the prompt's §15 ask.
- **Explicitly out of scope, named as its own future initiative**: a
  company switcher for one user owning multiple businesses (prompt
  §16-17). `User` is hard 1:1 with `Tenant` via a DB unique constraint
  today (`UniqueConstraint("tenant_id", "email")`) — this is a real
  schema change plus a switcher UI, comparably sized to a full LIMS-style
  build, not a slice of this one.

This ADR covers exactly the two confirmed gaps: closing the backend
authorization hole, and adding the missing route guard.

## What shipped

**Backend — `require_module(module_key)`** (`app/deps.py`): a new
dependency factory, composable with (not a replacement for)
`require_permission`. Looks up the requesting user's `Company` →
`IndustryProfile.enabled_modules` and 403s if `module_key` isn't in
that list, with `details: {"module": module_key}` so the frontend can
render a specific message. A tenant with no company or no industry
profile configured is treated as zero modules enabled — deny, not
allow, matching the platform's existing "unconfigured profile shows
nothing" default (ADR-010) rather than fail-open.

Applied at the **router level**, not per-endpoint: `laboratory.py`'s
and `printing.py`'s `APIRouter(...)` declarations each gained
`dependencies=[Depends(require_module("laboratory"))]` /
`(Depends(require_module("printing")))`. One line per router closes
every current and future endpoint in that module, rather than touching
~30 individual endpoint signatures in `laboratory.py` alone.

**Frontend — `RequireModule`** (`apps/web/src/components/industry/RequireModule.tsx`):
route-level counterpart to `buildNavigation()`'s item filtering,
mirroring `FeatureGate.tsx`'s existing "client-side hint, backend is
the real enforcement" split for billing-plan features (same component
family, same honesty about what layer actually protects the data).
Shows a loading skeleton while the profile is still being fetched
(never flashes the real page or the blocked page prematurely), then
either renders the route or a "This feature isn't enabled for this
business" state naming the tenant's actual profile, with links to the
dashboard and to `/settings/industry` (the already-existing
`IndustryConfigPage`). Wrapped around every `/lab/*` and
`/print-*`/`/production-board` route in `App.tsx`.

## Deliberately NOT built in this pass (named, not faked)

- **Visual profile-picker cards** at signup and in `IndustryConfigPage`
  (prompt §3) — both still use a plain `<select>`. Cosmetic, not a
  security or correctness gap; not attempted here.
- **Confirmation dialog before switching profile** (prompt §15) —
  `IndustryConfigPage` has explanatory text but the PATCH fires
  immediately on button click, no distinct "are you sure" gate.
- **Company switcher / multi-business-per-user** (prompt §16-17) — a
  real schema change (`User` is 1:1 with `Tenant` today), not touched.
- **Laboratory's own thin `enabled_modules`** (`["laboratory"]` only,
  no `sales`/`accounting`/`gst`) — a separate, already-named gap
  (confirmed via code comment in `services/industry.py`: "billing
  integration ... explicitly deferred"), not this ADR's concern.
- **Generalizing `require_module` beyond `laboratory`/`printing`** —
  the fix was scoped to the two resources confirmed to map 1:1 onto a
  genuinely industry-exclusive module. Other permission resources
  (`employees`, `payroll`, `receipts`, ...) were not audited for a
  clean module-key mapping and were left untouched rather than risk
  gating something that isn't actually industry-exclusive.

## Verification

4 new backend tests (`tests/test_industry_module_enforcement.py`) —
the actual bug reproduced and fixed in both directions: a
Printing-profile tenant's owner (who does carry `laboratory.*`
permissions) gets 403 with `details.module == "laboratory"` calling
`/api/v1/lab/sample-types` (both GET and POST); a Laboratory-profile
tenant gets 403 calling `/api/v1/print-machines`; the matching
industry's own tenant is confirmed unaffected (a printing tenant's own
`/api/v1/print-machines` call still succeeds) — proving `require_module`
doesn't become a second permission system that blocks legitimate
access. Full suite: 205 passed, zero regressions (up from 201).
Frontend `tsc --noEmit` and `vite build` both clean.

Live-verified against the running `docker-compose` stack via headless
Chromium: a real Printing-profile tenant's own `/print-machines` page
rendered normally with its own PRINTING sidebar section; navigating
that same session directly to `/lab/samples` by URL showed "This
feature isn't enabled for this business / Printing Press & Digital
Color Lab doesn't include this module" instead of the LIMS page.
Repeated in the opposite direction with a real Laboratory-profile
tenant: its own `/lab/samples` rendered normally, and `/print-jobs`
showed the same blocked state naming "Laboratory & Scientific Testing."

## Reversibility

Fully additive: one new backend dependency function, two `dependencies=[...]`
lines on existing routers, one new frontend component, and eight
`<Route>` elements in `App.tsx` wrapped with it. No existing endpoint
signature, model, or migration touched. Removing it means reverting
those router `dependencies=` lines and un-wrapping the routes — no
other code depends on `require_module` or `RequireModule` existing.
