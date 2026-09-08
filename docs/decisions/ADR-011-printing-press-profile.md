# ADR-011: Printing Press / Digital Color Lab -- a real production vertical, not a config entry

**Context:** the Printing Press directive is explicit and repeated: a
print shop is a Customer -> Job -> Artwork -> Prepress -> Production ->
Finishing -> QC -> Delivery -> Invoice -> Profitability business, not
products-in-a-cart, and must not be forced through the generic
sales/POS module set the way Retail, Grocery, Mobile, etc. were in
ADR-010. That's a correct call to make explicitly rather than silently
stamp out another `PROFILE_DEFINITIONS` entry: the other 20+ profiles
in ADR-010 are honest because the generic core (sales + inventory +
optional POS + accounting/GST + dynamic attributes) genuinely fits
them. It does not fit a job-and-production business, so this is the
one profile in the catalog backed by real new tables and a real
service, following the same precedent Retail's POS module already set
(ADR-010's first addendum) -- just larger.

**What's genuinely new: three tables.** `PrintMachine`, `PrintJob`,
`PrintJobArtwork` (migration `8e967888640c`). `PrintJob` is the central
entity -- no existing table models "a job moving through production
stages with an approval gate before it can start." Everything else the
66-section spec asks for is deliberately *not* a new table:

- **Media/paper/ink/consumables** are ordinary `Item` rows (a "Media"
  `Category` with `parameter_schema` for GSM/width/finish, exactly
  ADR-003's mechanism) with stock tracked through the existing
  `StockLedger`/`StockBalance`/`apply_ledger_movement` -- a
  `print_media`/`print_consumables` table would have been precisely
  the "hundreds of nullable columns on a duplicate universal table"
  anti-pattern the original 22-industry brief's own §57 warns against.
  A print shop's paper is not meaningfully different from a
  pharmacy's medicine or a retailer's t-shirt as an inventory concept.
- **Project-based printing** (spec §61) reuses `Project`/`Site`
  unchanged -- `PrintJob.project_id` is a plain FK, no new code.
- **Outsourcing** (spec §29-30) reuses `Supplier` --
  `PrintJob.outsource_vendor_id` is a plain FK, no new
  `print_outsource_jobs` table.
- **Billing** (spec §43-44) reuses `Invoice`/`InvoiceItem`/the journal
  exactly like `services/pos.py` does: `complete_job_and_invoice`
  imports `invoicing.py`'s `_post_invoice_journal` directly (same
  "B13: this arithmetic lives in one place" reasoning as ADR-010's POS
  addendum). A job with no catalogue `item_id` linked gets a lazily
  created "Print Job Charges" `Item` (mirrors `get_or_create_walkin_
  customer`) purely as the `InvoiceItem.item_id` FK anchor -- its own
  `gst_rate` is never read for tax (see the function's docstring for
  why: that row is shared across every job at the company, so mutating
  it per-invoice would leak one job's rate into the next job's
  invoice and show up as a spurious audit-logged change on a row
  nobody touched). Tax is resolved off `PrintJob.gst_rate` via a
  `SimpleNamespace(gst_rate=...)` stand-in instead, since
  `resolve_tax()` only ever reads `item.gst_rate`.

**Deliberately deferred, not faked.** The spec asks for a lot beyond
this. What ships is real; what doesn't ship is named here rather than
approximated:

- **N-up / sheet costing calculator (§16-19)**: not built. This is a
  genuine domain-specific algorithm (sheet layout, bleed, gutter,
  crop marks) that would need real print-industry input to get right,
  not something to guess at from a spec document. Staff enter cost
  components (`material_cost`, `printing_cost`, `finishing_cost`,
  `labor_cost`, `wastage_cost`) directly on the job instead --
  `job_profitability()` still gives a real, correct revenue-minus-cost
  breakdown (spec §44) from those, same as any other cost-entry flow
  in this codebase.
- **RIP/print-server integration (§39), color management (§38), AI
  production planner/quotation assistant/material forecasting
  (§50-53)**: not built. All explicitly named as external-system or
  AI-model integrations in the spec itself; nothing here fakes a
  connector or a recommendation with no model or gateway behind it,
  same reasoning as ADR-007's e-invoice/e-way-bill gateways.
- **Granular finishing/QC/wastage tables (§20, §27, §26)**:
  `PrintJob` carries `finishing_ops` (a JSONB list of operation names),
  `qc_status`/`qc_notes`, and a `wastage_cost` total instead of
  `print_finishing_operations`/`print_qc_records`/`print_wastage`
  tables with per-operation machine/operator/time tracking. A rework
  is a *new* `PrintJob` row linked via `rework_of_job_id` (spec
  §27-28's "linked to the original job"), not a mutation of the failed
  job -- so each attempt's own cost history stays honest for
  profitability, which is the part of §27-28 that actually matters for
  the "must affect job profitability" requirement.
- **Delivery/pickup as its own workflow (§42)**: `delivery_mode` +
  `delivered_at` fields only, not integration with the existing
  DeliveryChallan/Trip/Vehicle/Driver machinery from Slice 2 -- that
  integration is a reasonable follow-up (the machinery already exists
  and fits), just not built in this pass.
- **Machine capacity-aware scheduling (§11, §24-25)**: `PrintMachine`
  has `capacity_per_hour`/`capacity_unit` fields and a job can be
  assigned to one, but nothing computes a recommended schedule or
  queue-based ETA from them yet -- the fields exist for a scheduler to
  read later without a migration.
- **Customer portal upload/approval (§55) and mobile production app
  (§56)**: not built. The same staff-facing artwork upload/approve
  endpoints this ADR ships could back a portal flow later (same
  `save_file`/`PrintJobArtwork` shape Slice 6's portal document upload
  already uses), but wiring a customer-facing surface onto it is
  separate, deliberate work.

**One real business rule, enforced, not just documented.** Spec §14 is
explicit: "production must use the approved artwork version... prevent
accidental use of an older version." `update_job_status()` checks the
*latest* `PrintJobArtwork` row's status before allowing a transition
into any of `ready_to_print`/`printing`/`finishing`/`qc`/`packing`,
and a fresh upload always supersedes prior approval (job status resets
to `artwork_pending` on re-upload). Verified live against the running
API: a job cannot enter production with no artwork, still cannot after
an unapproved upload, and can immediately after approval. Beyond that
one gate, status transitions are free-form (matches §22's "drag jobs
where permitted" -- permission-gated in principle, not a rigid state
machine this spec didn't actually ask for).

**Reversibility:** the deferred pieces above are additive. A costing-
formula engine, RIP adapter, or DeliveryChallan integration slots in
without touching `PrintJob`'s existing columns. Finishing/QC granular
tables, if ever needed, sit alongside the current JSONB/status-field
approach rather than replacing it.
