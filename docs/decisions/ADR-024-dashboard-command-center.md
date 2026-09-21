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

## Addendum: the "Needs Attention" work queue

**What shipped:** five independent React Query calls, not one
aggregate endpoint — a slow or failing category must not block the
others (the request's own functional requirement). Each reuses or
lightly extends a real, already-tested endpoint:

- **Pending approvals** — `GET /approvals?status=pending`, unchanged
  (this is specifically credit-limit-override blocks on sales orders,
  ADR-009 — not a generic "things awaiting sign-off" queue; labelled
  generically since `ApprovalRequest.document_type` is itself generic).
- **Quotations awaiting response** — `GET /quotations?status=sent`.
  `list_quotations` gained an optional `status` filter (same pattern as
  every other filtered list in this codebase); `QuotationsPage.tsx`
  reads it from the URL too, so the work queue's link actually lands on
  a pre-filtered list, not the full unfiltered one.
- **Orders awaiting dispatch** — `GET /sales-orders?status=reserved`
  (`reserved` is the real, existing status a `SalesOrder` sits in
  between quotation-conversion and `POST .../dispatch` — see
  `models/sales.py`'s own lifecycle comment). `list_sales_orders`
  gained the same optional filter. This surfaced a real, standing gap:
  **Sales Orders had a detail route but no list page at all** —
  nothing in the app could show you your full set of orders. Built
  `SalesOrdersPage.tsx` (mirrors `QuotationsPage.tsx`'s pattern
  exactly, no create button since a Sales Order is never created
  standalone) and added it to the nav (`Sales & Dispatch`, module
  `sales`) and to the `open_sales_orders` KPI's click-through, which
  previously went nowhere.
- **Overdue invoices** — `GET /collections/priority`, unchanged; the
  row's detail line sums `amount_due` client-side.
- **Low-stock items** — the one genuinely new endpoint,
  `GET /low-stock-items` (`catalog.py`), matching the exact condition
  `services/notification_rules.py::check_stock_low_and_notify` already
  fires a one-off alert on (`StockBalance.qty_on_hand <= Item.
  reorder_level`, per warehouse, opt-in via a nullable `reorder_level`)
  — the first endpoint to read that condition back as a live list
  instead of a point-in-time notification.

**A real gap found while wiring up low-stock, fixed rather than
worked around**: `Item.reorder_level` has had a real column and real
notification-trigger logic since ADR-013, but was never in
`ItemCreate`, `ItemUpdate`, or `ItemOut` — no tenant could ever set it
through the app, which would have made the new low-stock endpoint
permanently, silently empty for every real tenant. Added to all three
schemas (the create/update endpoints already do `**payload.model_
dump()`, so no other backend code needed to change) and to the "New
item" form (`ItemsPage.tsx`) as an optional "Reorder level" field.
Editing the level on an already-existing item still has no dedicated
UI (the existing inline-edit affordance only covers price) — noted as
remaining, not silently left broken.

**Rows only render when they have something to say**: a category
gated on a module the active profile doesn't have is never queried at
all; a query that resolves to zero renders nothing (not a padded "0");
if every category is empty, one compact "Nothing needs attention right
now" line replaces the whole list — not a giant empty container.

**Verification**: full backend suite 219 passed (two filter params
added to existing endpoints, one new endpoint, one schema widened —
no existing behavior changed). Live-verified end to end on a seeded
Building Materials tenant: created a customer, an item with
`reorder_level=100`, a stock balance of 25 (below reorder — seeded
directly at the DB layer purely to exercise the read path, since
building a full purchase-receipt flow just to test a read-only report
was out of scope here), and a `sent` quotation. The dashboard correctly
showed exactly two rows — "Quotations awaiting response (1)" and
"Low-stock items (1)" — with the other three genuinely empty
categories rendering nothing; clicking through landed on `/quotations?
status=sent`, pre-filtered. Separately confirmed the "Nothing needs
attention right now" state on a freshly signed-up, unseeded tenant.

## Reversibility

Fully additive on the backend (two new response fields, one migration
appending widget keys). Frontend: `Kpi.tsx` and `DashboardPage.tsx`
were rewritten in place (old versions recoverable from git history);
`ItemsPage.tsx`/`CustomersPage.tsx` gained one query-param read each,
harmless when absent. No route, permission, or existing endpoint
signature changed.

## Addendum: Sales & revenue trend and Receivables-by-age charts

**What shipped**, in a responsive two-column layout directly below the
KPI grid: `SalesTrendChart.tsx` (a real per-day posted-invoice area
chart) and `ReceivablesChart.tsx` (a real ageing-bucket bar chart),
both using `recharts` (already a dependency, confirmed unused before
this). Followed the `dataviz` skill's procedure throughout — form
first, color last: a single time series needs no legend (the card
title names it), so the sales line uses one categorical-slot color;
the ageing buckets are a genuine severity scale (current -> overdue),
so they use the skill's fixed, never-themed **status** palette
(good/warning/serious/critical) rather than an arbitrary categorical
hue per bucket — mitigated per the skill's own contrast note (warning/
serious sub-3:1 on light) by the bars' own axis labels and direct
value labels, never color alone.

- **`GET /dashboard/sales-trend?days=`** (new, `dashboard.py`) — the
  one genuinely new endpoint this slice needed: daily `SUM(Invoice.
  total)` for posted invoices over the trailing 7/30/90 days (capped),
  zero-filled for every day in range so the chart never has to guess
  at a gap versus a real zero-sales day. Gated on `days ∈ [1, 90]`
  server-side regardless of what the client sends.
- **`GET /collections/ageing`** — zero new backend work; already built
  for `CollectionsPage.tsx`, rolled up by bucket client-side (a handful
  of invoices per tenant, not worth a new server-side aggregation).
- Both charts are gated on the module that actually backs their data —
  `accounting` for the sales trend, `collections` for receivables — not
  hardcoded to Building Materials, so the two-column section adapts
  per profile the same way the rest of the dashboard already does:
  present for the ~24 profiles with real invoicing, absent (not an
  empty placeholder) for Laboratory, which has neither module.
- Each chart owns its own loading skeleton, `ErrorState` with retry,
  and a real empty state (a "no posted invoices in this range yet"
  message with a working "New quotation" link for the trend chart; a
  checkmark "every invoice fully collected" state for receivables when
  outstanding totals to zero) — independent of the KPI grid and each
  other, consistent with the dashboard's per-widget loading/error rule.
- The sales-trend date-range toggle (7d/30d/90d) is the one *working*
  date-range control this dashboard has — scoped to that one chart
  since it's the only widget with a real range-parameterized backend;
  the header's own date-range control is still deliberately absent
  (see above) since nothing else responds to one yet.

**Verification**: full backend suite 219 passed (one new endpoint, no
existing behavior changed). `tsc`/`vite build` clean. Live-verified end
to end on a seeded Building Materials tenant: drove a real quotation
through send -> approve -> convert-to-order -> dispatch -> invoice,
producing one real posted ₹24,780 invoice; the sales trend chart showed
a real zero-filled 30-day line spiking exactly on the invoice date,
correctly re-fetching and re-rendering when toggled to 7d; the
receivables chart showed a real green "Current" bar at ₹24,780 (the
invoice's due date is 30 days out, correctly not-yet-overdue) with the
other buckets correctly empty; Inventory value simultaneously reflected
the real post-dispatch stock draw-down. Separately confirmed a
Laboratory tenant's dashboard renders with neither chart present and no
dead gap left behind, since Laboratory has neither `accounting` nor
`collections`.

## Addendum: Recent Activity — the last dashboard slice

**What shipped**: `RecentActivity.tsx`, the final section of this
redesign, needing **zero new backend data**. `audit_trigger_fn` (the
DB trigger from ADR at Slice 0) has populated `audit_log` for every
INSERT/UPDATE/DELETE across ~40 tables since before this dashboard
existed; `GET /audit-logs` (`audit.view`) already read it back raw
(`table_name`, `action`, `old_data`/`new_data` JSON, `changed_by_user_
id`). This slice is entirely a translation layer over real, already-
recorded events — no fabricated activity, ever, by construction:
a row only appears here because a real write happened.

- **A curated `TABLE_META` map** gives ~12 business-relevant tables
  (quotations, sales_orders, invoices, customers, suppliers, purchase_
  orders, receipts, delivery_challans, stock_transfers, items,
  branches, warehouses, companies, users) a real singular label and a
  real deep link straight to the record (`/quotations/{id}`,
  `/invoices/{id}`, ...) — reusing routes this project already built,
  several in earlier addenda to this same ADR. Every other audited
  table (there are dozens — `roles`, `financial_years`, `accounts`,
  ...) still renders, with its plain table name and no link, rather
  than either crashing on an uncurated table or hiding real activity
  the curation didn't anticipate.
- **Smarter-than-raw verbs for UPDATE**: comparing `old_data.status`
  to `new_data.status` turns a generic "Quotation updated" into
  "Quotation QT-2026-27-000001 marked approved" — genuinely more
  informative than the raw action, still derived only from real
  trigger-captured data, never invented.
- **User attribution** resolves `changed_by_user_id` against `GET
  /users` (fetched once, best-effort — a role without `users.view`
  still sees the feed, just without the "by <name>" clause, same
  graceful-403 pattern as every other permission-gated dashboard
  widget in this ADR).
- **A small, explicit `NOISE_TABLES` filter** (`role_permissions`,
  `user_roles`, `roles`, `doc_number_counters`) drops pure internal-
  bookkeeping rows client-side — found live-testing on a freshly
  signed-up tenant, whose first 15 audit rows were 4 "role permissions
  created" entries crowding out the real "Customer created"/"Item
  created" events sitting right below them. Filtering, not hiding: the
  endpoint is over-fetched (`limit=75`) so a chatty tenant still gets a
  full 15 real rows after the filter, rather than a short list.
- Own loading skeleton, error+retry, forbidden state, and empty state
  — independent of every other widget, same as the rest of this ADR.

**Verification**: `tsc --noEmit`/`vite build` clean; full backend
suite untouched (219 passed) since no backend code changed. Live-
verified end to end: drove a real quotation through create -> send ->
approve on a fresh tenant and watched the feed render "Quotation
QT-2026-27-000001 marked approved · Neha Verma", "... marked sent",
"... created", each a distinct real audit row with correct attribution
and relative time; clicking the "marked approved" row navigated to
that exact quotation's real detail page (`/quotations/{id}`), not just
the list. Confirmed the noise filter live: before the filter, 4 of a
fresh tenant's first 8 visible rows were bookkeeping noise; after, all
8 were genuine business/setup events (quotation lifecycle, item
creation, customer creation, branch/company creation). Confirmed no
horizontal overflow and a correctly single-column chart stack at
390px alongside the rest of the dashboard.

## What's genuinely done, and what's still open

With this addendum, every section of the original request now has a
real, live-verified implementation except the two named as out of
scope from the start: **per-user dashboard customization** (reorder/
hide widgets, saved layout) and a **working date-range/branch filter
on the header** (both need real new backend capability — a per-user
preferences store, and query parameters threaded through every summary
query — neither of which this project's "reuse real data, no
nonfunctional controls" rule permits faking). Header, KPI grid, Quick
Actions, the Needs Attention work queue, the Sales & Revenue and
Receivables charts, and Recent Activity are all real, live-verified,
and adapt correctly per industry profile.
