# ADR-017: Suppliers list page -- real aggregates, no fabricated fields

**Context:** the ask was an "enterprise-grade" refactor of the Suppliers
list page: KPI cards, search/filter, an expanded table, bulk actions,
sorting, pagination. The spec named four KPIs and eight table columns;
research before writing any UI confirmed which of those already existed
as real data and which didn't exist anywhere in the schema.

## What's real, and what was renamed instead of faked

Three of the four requested KPIs, and most of the table columns, map
directly onto real columns or an already-trusted computation
(`services/supplier_credit.py::compute_payable`, the same function
`GET /suppliers/{id}/360` has used since Slice 3) -- Total Suppliers,
Active Purchase Orders, and Total Outstanding Balance are all real
aggregate queries, not placeholders.

**"Pending GST Validation" does not exist anywhere in this codebase**
-- no field, no verification workflow, no GSTN API integration (which
would need real credentials this environment doesn't have, the same
reasoning ADR-007's e-invoice gateway and ADR-014's payment gateway
already used). Building a fake "pending/validated" badge with no real
verification behind it would be worse than not building it. Instead,
the KPI is **"Missing GSTIN"** -- a real, honestly-labeled count of
suppliers with no GSTIN on file, computed from the same `Supplier.gstin
IS NULL` check a real GST-validation feature would need as its first
input anyway. Same reasoning for the table's category/status columns:
`category` is a real new column (below), and "Status" only ever shows
Active/Inactive (`Supplier.is_active`) -- never a fabricated "Pending"
state the schema has no way to represent.

## Backend changes (real, bounded)

- **`Supplier.category`** (nullable string, migration `dc319c49d45d`):
  free text, not a fixed enum -- what a supplier "category" means
  varies by industry (per the Industry Profile Engine, ADR-010), and
  inventing a fixed taxonomy here would be new, unrequested scope.
- **`compute_payable_bulk()`** (`services/supplier_credit.py`): the
  exact same opening-balance + billed − allocated math as
  `compute_payable()`, batched into two `GROUP BY` queries instead of
  N per-supplier calls, for the list page's up-to-200-row response.
  Live-verified equal to `compute_payable()` for a real supplier via
  direct API calls, and locked in by
  `test_compute_payable_bulk_matches_per_supplier_compute_payable`.
- **`GET /suppliers/summary`**: the four real KPI aggregates in one
  call, all tenant-scoped.
- **`PATCH /suppliers/{id}`**: real edit, using the `suppliers.edit`
  permission code -- already existed in the platform catalog (the
  `RESOURCES`×`ACTIONS` cross product has covered every resource since
  before this feature), so unlike five earlier features this session,
  this one needed **no** permission-backfill migration.
- **`GET /suppliers?include_inactive=true`**: the list endpoint
  defaulted to active-only before this change, which a purchase-order
  supplier picker (`PurchaseOrdersPage.tsx`, the endpoint's other
  consumer) genuinely wants -- but it meant "Deactivate" from the new
  management page's action menu was a one-way door: the row would just
  vanish with no way back. `include_inactive` is opt-in, so the picker
  is unaffected (verified: its default response still excludes a
  deactivated supplier) while the management page can see and reverse
  its own action.
- **No delete endpoint.** Suppliers are referenced by
  `PurchaseOrder`/`PurchaseBill` FKs (`ondelete="RESTRICT"`), and no
  other master-data resource in this app exposes a hard delete. The
  spec's "Delete" action menu item is deactivate/activate instead --
  real, safe, and reversible, rather than a new destructive endpoint
  invented as a side effect of a UI refactor.

## Frontend

Real, working bulk actions rather than decorative checkboxes: the
row-selection checkboxes feed CSV export (selected rows, or all
filtered rows if none selected) -- a real client-side CSV built from
what's on screen, not a server round-trip. Sorting (name/state/
outstanding) and pagination are client-side over the already-fetched
list (server caps at 200 suppliers), same tradeoff the existing
`q`-filtered list endpoint already made. Two new shadcn-style
primitives (`components/ui/dialog.tsx`, `dropdown-menu.tsx`,
`checkbox.tsx`) wrap Radix packages already a dependency
(`@radix-ui/react-dialog`) or newly added
(`@radix-ui/react-dropdown-menu`, `@radix-ui/react-checkbox`) --
reused as-is rather than hand-rolled, since an actions menu and a
bulk-select checkbox are exactly what those primitives are for.

## Explicitly deferred

Real GSTIN validation against the GSTN API (needs real credentials);
a fixed supplier-category taxonomy (free text today, matching the
industry-agnostic pattern used elsewhere); server-side pagination
(the existing 200-row cap makes client-side pagination correct for
now, not a shortcut around a real scale problem); a supplier
hard-delete (no product need identified, and none of this app's other
master-data resources have one either).
