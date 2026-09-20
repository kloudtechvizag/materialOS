# ADR-024: Dashboard redesign — header, KPI grid, and Quick Actions

**Context:** a master-prompt-style request asked for a full "business
command center" redesign of `DashboardPage.tsx`: a real header
(greeting, context, refresh, date range, branch filter), a compact KPI
grid with trend/comparison indicators, sales/receivables charts, a
"Needs Attention" work queue, a recent-activity feed, and a compact
Quick Actions panel — explicitly required to be the **same structure
for every industry profile**, not a different dashboard per profile.
This is a genuinely multi-week scope; consistent with how every other
large request this project has taken has been handled, it was audited
first and split into slices, with the user picking **Header + KPI
grid + Quick Actions** to build first (charts, the work queue, and the
activity feed need real new backend aggregation work and are
explicitly deferred, not attempted half-built).

## What the audit found

- `recharts` is already a dependency (unused) — a future charts slice
  needs no new library.
- `/dashboard/summary` (`api/v1/dashboard.py`) already computes
  `total_outstanding`, `total_invoiced`, `open_quotations`,
  `open_sales_orders`, `active_items`, `active_customers`, plus
  profile-specific POS/printing widgets — all real, tenant-scoped
  aggregates, zero mock data.
- **No period-over-period comparison data exists anywhere.** Every
  summary field is a live, all-time (or "today") snapshot, not a
  time series. A trend arrow ("+12.4% vs last month") would need a
  new time-series endpoint — exactly what the deferred charts slice
  requires anyway, so no fake or one-off comparison was added here
  (see "Not built" below).
- **Sales Orders and Invoices have no standalone "create" page.** A
  Sales Order only ever comes from `POST /quotations/{id}/convert-to-
  order`; an Invoice only from `POST /sales-orders/{id}/invoice`. This
  matters directly for Quick Actions: "+ Sales order" / "+ Create
  invoice" buttons, as literally requested, would have had nowhere
  real to send the user.
- `GET /collections/priority` (`services/collections.py::
  collection_priority`) already computes real overdue-invoice ageing
  (amount due, days overdue, bucket) — reused for the Receivables
  KPI's status hint rather than re-derived.
- `StockBalance.qty_on_hand` (materialised, `services/inventory.py::
  rebuild_stock_balance`) × `Item.standard_cost` is a real, cheap
  aggregate for "Inventory value" — genuinely missing from the summary
  endpoint, added here (not a new endpoint, an enriched existing one).
- `GET /auth/me` (`full_name`) is already fetched and cached by
  `AppShell.tsx` under the query key `["current-user"]` — the
  dashboard's greeting reuses that exact cache entry, not a second
  network call.
- `GET /companies` already returns a company `name` field the frontend
  simply never typed/exposed.

## What shipped

**Backend** (two additive fields on the existing `/dashboard/summary`,
no new endpoint): `inventory_value` (the StockBalance×Item join above)
and `has_overdue_receivables` (`len(collection_priority(db)) > 0`).
`inventory_value` was added to the shared `DEALER_WIDGETS`/
`DEALER_WIDGETS_WITH_QUOTES` widget-list constants (`services/
industry.py`), which 13 profiles already share (building_materials,
retail, fmcg, auto_parts, food_beverage, computer_hardware, furniture,
book_publishing, travel, electrical, paper_mill, paint, mobile) —
`DEALER_WIDGETS_WITH_QUOTES` profiles drop `active_items` to hold the
grid at 6 cards, since it and `inventory_value` describe the same
catalog and the latter is more informative for a trading business.
Migration `e7f8a9b0c1d2` backfills the 13 already-seeded rows (the
established pattern: `ensure_industry_profile_catalog()` never updates
existing rows).

**`Kpi.tsx`, fully redesigned**: the old 40×40-icon-box-plus-padding
card (the literal "large purple icon and large empty area" the request
named) is gone. A compact card now shows an uppercase label, a bold
value, and an optional real status `hint` (e.g. "Needs review" /
"All current" / "View inventory") — never a fabricated trend, per the
"no meaningless comparisons" rule. `formatINRCompact` (`lib/format.ts`,
new, additive — `formatINR` is untouched everywhere else it's used)
renders large rupee amounts as `₹8.42L`/`₹1.05Cr` instead of the full
digit string, matching the request's own example.

**`DashboardPage.tsx` header**: greeting (`/auth/me`, shared cache) +
company name + active profile badge + "Updated Xs/m/h ago"
(`useQuery`'s own `dataUpdatedAt`, not a second timer) + a working
Refresh button + a "+ Create" button reusing the profile's
`golden_workflow` CTA (ADR-023). **Explicitly not added**: a date-range
selector and a branch filter. Both were in the request, but neither
has backing data — every summary field is an all-time/today snapshot
with no date or branch parameter anywhere in the query layer, and
wiring one in would mean touching every query in the endpoint, well
beyond a "zero new backend endpoint" slice. Building a selector that
changes nothing would violate the request's own "no nonfunctional
controls" rule more than omitting it does.

**Quick Actions panel** replaces the oversized "Start the golden
transaction" card. Real entry points only: the profile's own
`golden_workflow` CTA, "New quotation" (only if `sales` is enabled and
not already the CTA), "Add customer" and "Add {item label}" (always —
every profile has a real home for both per ADR-023's addendum), and
"Collect payment" → `/collections` (only if `collections` is enabled).
"Add customer"/"Add {item}" now actually open the create form on
arrival (`ItemsPage.tsx`/`CustomersPage.tsx` read a new `?new=1` query
param to default `showForm`), not just the list — a small, real
behavior change, not a cosmetic link change. A compact workflow strip
below the buttons shows `golden_workflow.steps` with a real
`open_sales_orders` count next to the "Sales order" step specifically
(the one step name that matches an existing summary field exactly);
every other step renders without a fabricated count.

## Deliberately not built in this pass

- **Sales & revenue / receivables charts** — needs a new time-series
  backend endpoint (sales grouped by day/week over a range); `recharts`
  is ready for it, nothing else is.
- **"Needs Attention" work queue** — approvals and orders-to-dispatch
  reuse existing endpoints; low-stock needs a new endpoint (`Item` ×
  `StockBalance` vs `reorder_level`, real data, not built yet); overdue
  invoices' full breakdown already exists via `/collections/priority`
  and just needs a work-queue-shaped UI around it.
- **Recent activity feed** — `GET /audit` is real but raw (table_name/
  action/old_data JSON); this slice is mostly a human-readable
  translation layer, not new data.
- **Dashboard customization** (reorder/hide widgets, saved layout) —
  no per-user dashboard-preference storage exists; a real, separate
  schema addition.
- **Date range and branch filters** — see above; both need real
  backend parameter support across every summary query, not a header
  cosmetic change.
- **Trend/comparison indicators on any KPI** — no historical snapshot
  or time-series data exists yet; would require the same backend work
  as the charts slice above.

## Verification

Full backend suite: 219 passed, zero regressions (two additive summary
fields, no existing query changed). `tsc --noEmit` and `vite build`
clean. `npm run check:nav-modules` still passes. Live-verified against
the running `docker-compose` stack via headless Chromium on a fresh
Building Materials tenant (owner "Ravi Kumar", company "Sri Balaji
Building Materials"): header shows "Good morning, Ravi" and the real
company/profile names; the KPI grid renders 6 compact cards with real
values and status hints (confirmed both the zero-data state and after
seeding a real customer and item, "Active customers" correctly moved
from 0 to 1); clicking "Receivables" navigated to `/collections`;
Refresh re-fetched without a page reload; the "+ Add customer" quick
action landed directly on the open create form via `?new=1`, not the
bare list. Confirmed responsive at 1440px (6-column grid) and 390px
(2-column stack, no horizontal overflow, header wraps cleanly).

## Reversibility

Fully additive on the backend (two new response fields, one migration
appending widget keys). Frontend: `Kpi.tsx` and `DashboardPage.tsx`
were rewritten in place (old versions recoverable from git history);
`ItemsPage.tsx`/`CustomersPage.tsx` gained one query-param read each,
harmless when absent. No route, permission, or existing endpoint
signature changed.
