# MaterialOS — Master Build Brief v2

**AI-Powered Building Materials Business Operating System**
Status: build brief for engineering + AI coding agents
Supersedes: MaterialOS Master Product & Development Prompt v1

---

## 0. What changed from v1, and why

v1 is a 116-section feature catalogue. Handed to a coding agent, it produces 116 shallow screens and zero working business. Six structural problems:

| # | Problem in v1 | Fix in v2 |
|---|---|---|
| 1 | No scope ceiling. Weighbridge, fleet fuel, BI cubes, supplier portal and digital catalogue sit at the same priority as invoicing. | Part F: 7 slices, each independently shippable. Everything else moved to Appendix backlog, explicitly *not* a requirement. |
| 2 | Over-specifies UI (sections 6–9, 79–84), under-specifies correctness. No word on decimal precision, rounding, concurrency, idempotency, gapless numbering, or period locks — the things that actually destroy an ERP. | Part B: 14 non-negotiable invariants with test obligations. |
| 3 | "GST-ready", "e-invoice architecture" — no actual compliance spec. GST 2.0 changed the slabs in Sep 2025; cement moved 28% → 18%. A cement product that ships the wrong rate is dead on arrival. | Part D: dated compliance spec with current thresholds and API changes. |
| 4 | No migration path. Every target customer already runs Tally, Busy or Marg with 5–15 years of ledgers. "Import from Excel" is not a migration. | Part F Slice 0: Tally/Busy import is a launch blocker, not a nice-to-have. |
| 5 | "Offline-first mobile" applied to the whole app. Full offline ERP with conflict resolution is a 6+ month project on its own and is the single most common reason products like this never ship. | Part E: offline scoped to 4 named flows, append-only, no server-state mutation. |
| 6 | No commercial layer. No ICP, no price point, no answer to "why not Tally + WhatsApp, which costs ₹18,000 once". | Part A. |

Nothing valuable was deleted. The full v1 feature set survives in the Appendix as a prioritised backlog.

---

## PART A — Product thesis

### A1. Who this is for (ICP, in priority order)

1. **Primary:** Cement + TMT dealer/distributor, ₹8–80 cr annual turnover, 1–4 branches, 5–40 staff, 2–8 own or contracted vehicles, Tier-2/Tier-3 India. Already on Tally for books. Runs operations on WhatsApp, a notebook, and the owner's memory.
2. **Secondary:** Multi-category building-material retailer (hardware, plumbing, electrical, tiles, paint), single or twin branch.
3. **Deferred:** Enterprise distributors >₹300 cr, manufacturers, marketplaces. Do not design for them. Do not let their requirements into Slices 0–4.

### A2. The wedge — what actually gets them to switch

They will not switch for "an ERP". They switch for one of these, and only one is needed to win the deal:

- **Outstanding recovery.** Owner does not know today, in one number, who owes what and for how long. Every rupee of DSO reduction is direct cash.
- **Godown truth.** Physical stock never matches the book. Loading/dispatch is where leakage happens.
- **Margin per bag/tonne after freight and unloading.** Nobody computes landed cost. They price from memory.

**Everything in Slice 1–3 exists to serve those three.** If a proposed feature does not measurably improve one of them, it goes to the backlog.

### A3. Why not Tally

MaterialOS does **not** replace Tally in year one. It sits in front of it and, at first, exports to it. Positioning: *Tally keeps your books. MaterialOS runs your business.* Books stay where the CA is comfortable. This removes the single largest adoption objection and is why the Tally export adapter (Slice 4) is mandatory, not optional.

### A4. Commercial model

- ₹2,500–₹9,000/month per branch, by tier. Annual paid up front (this market pays annually; monthly churns).
- Free for the first 60 days *with data migration done by us* — migration is the sale, not the trial.
- Per-user pricing fails here (they will share logins). Price per branch + per active vehicle.
- Named tiers, entitlement-flagged: Starter / Growth / Multi-Branch / Enterprise.

### A5. Relationship to nirmaanOS

nirmaanOS (construction management) and MaterialOS (material dealer) are two sides of the same transaction: nirmaanOS *procures*, MaterialOS *supplies*. **Decide this before Slice 0** — it is the most expensive decision in the document:

- **Option A — separate products, shared nothing.** Fastest to ship, no coupling. Recommended unless a customer is already asking for the link.
- **Option B — shared platform (auth, tenancy, products, documents), two product surfaces.** Saves ~3 months across the second product, costs ~6 weeks up front and permanently couples release cycles.
- **Option C — shared plus a network layer** (a nirmaanOS project sends an RFQ that lands in a MaterialOS dealer's inbox). Highest ceiling, real defensibility. Do not attempt before both products have paying customers.

**Default: Option A now, Option C later via public API.** Record the choice as ADR-001.

---

## PART B — Non-negotiable invariants

An AI agent will violate these silently unless they are stated as laws with tests attached. Each has a mandatory test.

**B1. Money is never a float.** All monetary values: PostgreSQL `NUMERIC(18,4)` internally, Python `Decimal`, integer paise over the wire (JSON `amount_paise`). Never JS `number` for money in the frontend beyond display formatting.
*Test:* property test — 10,000 random invoices; sum of line amounts + tax − discounts == header total, exactly.

**B2. Quantity carries its unit, always.** No bare numbers. Every quantity is `(value, uom, product_id)`. Conversions go through one function, `convert(qty, to_uom, product)`, which uses the product's conversion table and never a global constant.
*Test:* pieces → kg → MT → pieces round-trips within defined tolerance for every product with a conversion set.

**B3. Stock is derived, never stored as truth.** `stock_ledger` is append-only and immutable. `stock_balance` is a materialised projection, rebuildable from zero at any time. Corrections are new reversing entries, never edits.
*Test:* nightly job replays the entire ledger and asserts equality with `stock_balance`. Fails the build if it drifts.

**B4. Reservation is atomic and race-safe.** Two concurrent orders for the last 100 bags: exactly one succeeds. `SELECT ... FOR UPDATE` on the balance row, or an advisory lock keyed on `(warehouse_id, product_id)`. Never read-then-write.
*Test:* 50 concurrent reservation requests against 100 units; total reserved is exactly ≤ 100.

**B5. Every journal balances.** Sum(debits) == sum(credits) per journal entry, enforced by a database constraint or a deferred trigger, not by application code alone.
*Test:* a transaction cannot commit with an unbalanced journal.

**B6. Business transactions are atomic across subsystems.** Invoice + items + stock ledger + journal + tax rows commit together or not at all. One DB transaction. No "post to accounting later" queue for the primary write path.
*Test:* fault injection at each step leaves zero orphaned rows.

**B7. Document numbers are gapless and concurrency-safe.** Per (company, branch, doc_type, financial_year). Use a dedicated counter row with `FOR UPDATE`, not a PostgreSQL sequence (sequences gap on rollback; GST auditors ask about gaps). Numbers are stored uppercase and uniqueness is case-insensitive — the IRP uppercases invoice numbers for IRN generation.
*Test:* 200 concurrent invoice creations produce 200 consecutive numbers, no gaps, no duplicates.

**B8. Every write endpoint is idempotent.** Client supplies `Idempotency-Key`; server stores the key + response for 24h. Non-negotiable given flaky mobile networks — the alternative is duplicate invoices in the field.
*Test:* same key replayed 10× creates one record.

**B9. Tenant isolation is enforced at the database, not the ORM.** PostgreSQL Row-Level Security with `app.current_tenant` set per connection. An agent *will* eventually forget a `.filter(tenant_id=...)`. RLS makes that a 0-row result instead of a data breach.
*Test:* every table with `tenant_id` has RLS enabled; a query without the session variable returns nothing. Enforced in CI by schema introspection.

**B10. Closed periods are immutable.** Once a financial period is locked, no insert/update/delete of any dated transaction within it, for any role, without an explicit unlock event that is itself audited.
*Test:* posting into a locked period raises `PERIOD_LOCKED`.

**B11. Nothing is hard-deleted.** Transactions are cancelled or reversed; masters are deactivated. `deleted_at` exists only on drafts.

**B12. Audit is written by the database, not by developers.** A generic trigger on audited tables writes old/new JSONB to `audit_log`. Application-level auditing gets forgotten on exactly the endpoint that matters.

**B13. Rounding is specified, not incidental.** Tax computed per line at `NUMERIC(18,4)`, rounded to 2 decimals at the line, invoice total rounded to the nearest rupee with the difference posted to a `Round Off` ledger. This rule appears in exactly one module.
*Test:* golden-file tests against 50 real invoice shapes including reverse-charge and mixed-rate baskets.

**B14. AI never writes.** AI tools are read-only by default. Any AI-proposed mutation produces a *draft* that a permitted human confirms. There is no code path from an LLM response to a committed price, stock movement, journal entry, refund, credit approval or tax filing.
*Test:* the AI tool registry has a `mutates: bool` field; CI fails if any registered tool has `mutates=True` without a `requires_human_confirmation` handler.

---

## PART C — Domain model and ubiquitous language

Use these words in code, DB, API and UI. Do not synonymise.

| Term | Means | Not |
|---|---|---|
| **Item** | A sellable SKU with a fixed parameter set (ACC PPC 50kg bag) | "Product" as a loose category |
| **Batch** | A received lot with its own date, cost and heat/mill data | Serial number |
| **Yard/Godown** | A stock-holding location | Branch |
| **Reservation** | A soft hold against a Sales Order, releasable | Allocation to a specific batch |
| **Allocation** | A hard link between an order line and a specific batch/bin, created at picking | Reservation |
| **Site** | A physical delivery destination | Project |
| **Project** | A commercial container for requirement, orders and profitability, having 1..n Sites | Site |
| **Landed cost** | Purchase price + freight + unloading + handling, allocated | Purchase price |
| **Outstanding** | Invoiced − allocated receipts | Order value |

**Core aggregates (transaction boundaries):** Order, Delivery, Invoice, Receipt, GoodsReceipt, StockMovement, JournalEntry. Cross-aggregate consistency is via events, never via a shared write.

**Two things v1 missed:**

- **Rate contracts.** A dealer commits a price to a builder for a project for 3 months. This is not a "price list" — it is a dated agreement with a quantity ceiling that overrides all other pricing and must be visible on every quote for that project. Model it as a first-class entity.
- **Cash sale vs credit sale as different objects.** ~40% of counter sales in this trade are cash, no GSTIN, no ledger account. Forcing them through a customer master is why POS in generic ERPs is unusable. Model `WalkInSale` with an optional customer link.

---

## PART D — India compliance spec

*Verified September 2026. Every fact below carries a date because these change; the compliance module must be independently versionable and every rule must be effective-dated in the database, never a constant in code.*

### D1. GST rates (GST 2.0)

Effective **22 September 2025**, the four-slab structure was replaced by a two-slab regime of 5% and 18%, with a 40% de-merit rate. Relevant to this product:

- **Cement and clinker, HSN 2523 — 18%** (down from 28%). Includes OPC, PPC, white, slag, aluminous.
- **Cement articles / RMC / precast, HSN 6810 — 18%.**
- Paints, tiles: moved to 18%.
- Sand: 5%. Bricks and blocks: 5% where notified under concessional provisions.
- Steel/TMT: 18%.

**Implication:** any rate table seeded before Sep 2025 is wrong. Seed data must be effective-dated with `valid_from`/`valid_to` and the invoice must resolve the rate as of the *document date*, not `now()`.

### D2. E-invoicing (IRN)

- Mandatory at **AATO > ₹5 crore** in any FY since 2017-18. In force since 1 Aug 2023, unchanged as of mid-2026. Threshold is PAN-level and permanent — once crossed, it applies forever, including to all GSTINs under that PAN.
- Applies to B2B, exports, SEZ, deemed exports. **Not** B2C.
- AATO ≥ ₹10 crore: invoice must be reported to the IRP within **30 days** of invoice date.
- 2FA mandatory on portal access.
- Invoice numbers are treated case-insensitively and auto-uppercased for IRN generation (since 1 Jun 2025) — see invariant B7.
- Penalty for a missing e-invoice: ₹10,000 per invoice or 100% of tax, whichever is higher.

**Implication:** most of the ICP is *above* ₹5 cr. E-invoicing is a Slice 4 requirement, not "future architecture". Build against a GSP/ASP adapter interface with two implementations (sandbox, live) so the vendor is swappable.

### D3. E-way bill

- Threshold ₹50,000 for interstate; intrastate thresholds vary by state and go up to ₹2,00,000. **State-configurable, never hardcoded.**
- Validity: 1 day per 200 km regular cargo; 1 day per 20 km ODC.
- **180-day rule:** an EWB cannot be generated against a document dated more than 180 days ago (error 820 on the portal, 4043 via IRP API).
- Extension capped at 360 days from original generation.
- Cancellation only within 24 hours.
- Blocked if GSTR-3B is unfiled for two or more consecutive periods.
- An IRN cannot be cancelled while an active EWB exists against it.
- **API change effective 1 August 2026:** Ship-to GSTIN becomes mandatory in IRN and EWB APIs when ship-to information is present (`URP` for unregistered consignees); ship-to details entered at IRN are not overridden at EWB creation. A voluntary EWB closure facility now exists (supplier/recipient/transporter can declare delivery complete), with an NIC API. Updated NIC API specs were in sandbox with production targeted mid-2026.

**Implication for the domain model:** Site must carry its own GSTIN field (often different from the customer's billing GSTIN — a builder's site in another state). This is exactly the kind of detail generic ERPs get wrong and is a genuine differentiator. Generate IRN and EWB in the same session as the invoice; never queue them.

### D4. Compliance architecture rule

All of D1–D3 lives in one module (`tax/`) behind an interface:

```
resolve_tax(document_date, place_of_supply, item, customer) -> TaxBreakdown
```

No GST logic anywhere else in the codebase. Rates, thresholds and validity formulas are rows in effective-dated tables, seeded by migration, editable by a platform admin. A rate change must be a data change, not a deploy.

---

## PART E — Locked technical decisions

These are decided. An agent must not re-litigate them mid-build; changing one requires a new ADR.

**Stack (as v1, confirmed):** React + TypeScript (strict) + Vite + Tailwind + shadcn/ui + TanStack Query + Zustand + React Hook Form + Zod. FastAPI + SQLAlchemy 2.x + Pydantic v2 + Alembic + PostgreSQL 16. Redis + Celery. S3-compatible object storage. Docker Compose for dev, Kubernetes-ready manifests but **not deployed to K8s before Slice 5** — Compose on a single well-sized VM serves the first 50 tenants and saves a month.

**Additions v1 omitted:**
- **PostgreSQL RLS** for tenancy (invariant B9). Single database, shared schema, RLS isolation. Schema-per-tenant is a maintenance trap at >50 tenants.
- **Money:** `NUMERIC(18,4)` + `Decimal` + paise on the wire.
- **Migrations:** every migration reversible, tested against a production-shaped dataset in CI.
- **Feature entitlements** as a service (`entitlements.check(tenant, "ai.assistant")`), consulted in the API layer. Never `if plan == "pro"` in a component.

**Mobile — one architecture: React Native + Expo.** Rationale: shares TypeScript types, Zod schemas and API client with web; team of one stack. Flutter is a fine choice in isolation but doubles the type-definition surface.

**Desktop — Tauri, and only for Slice 3+.** Its sole justification is hardware: thermal printers, barcode scanners, cash drawers, weighbridge serial ports. If the web app can do the job via WebUSB/WebSerial for the first cohort, defer Tauri entirely.

**Offline — deliberately narrow.** Full offline ERP is out of scope, permanently. Offline is supported for exactly four flows, all append-only, none of which mutates server state on the client:

1. Customer visit / check-in
2. Payment collection receipt
3. Delivery status update + POD capture
4. Order *draft* creation (draft only — never a confirmed order, because stock reservation cannot be done offline)

Mechanism: local SQLite queue, client-generated UUIDv7, server-side idempotency by that UUID, last-writer-wins never used — conflicts surface to the user. Reference data (customers, items, prices) is cached read-only and refreshed on connect.

**Explicitly deferred to post-Slice-6 (do not build, do not scaffold):** weighbridge integration, fuel/maintenance tracking, load optimisation algorithms, digital catalogue, supplier portal, report builder, OpenSearch, SSO, marketplace integrations, multi-currency, BI cube layer, voice ordering.

---

## PART F — Slice plan

Replaces v1's Phases. Each slice is vertically complete (DB → API → rules → web → mobile where relevant → permissions → audit → tests) and independently demoable to a real dealer. **Do not start slice N+1 until slice N passes its acceptance test with a real customer's data.**

Realistic effort with 3–4 engineers: Slices 0–3 ≈ 7–9 months. v1 implied a 2-year programme without saying so.

---

### Slice 0 — Foundation + migration (6–8 weeks)

Monorepo, auth, tenancy with RLS, RBAC, design system, CI, migrations, audit triggers, numbering engine, financial year, error/response envelope, health endpoints.

**Plus the thing v1 omitted: the Tally/Busy importer.**

- Read Tally XML export (Masters + Vouchers) and Busy/Marg CSV.
- Import: ledgers → customers/suppliers with opening balances; stock items → items; opening stock with rates.
- Six-step pipeline: upload → detect format → map columns → validate → preview diff → commit, with a downloadable error report. No import ever commits without a preview.

**Acceptance:** a real dealer's Tally company loads in under 10 minutes and their outstanding total matches their Tally receivables report to the rupee.

---

### Slice 1 — Sell and stock (8–10 weeks)

Items with dynamic parameter sets (cement, TMT, generic). UOM conversions. Batches. Warehouses/bins. Stock ledger + projection. Price engine + rate contracts. Customers with credit limits. Quotation → Sales Order → Reservation → Delivery Challan → Invoice → Receipt. POS/counter sale with walk-in. Landed cost and margin display at quote time.

**Acceptance (the golden transaction — this is the real product test):**
ABC Constructions / Green Valley Apartments / Vizag site, 500 bags cement + 2 MT 12mm TMT, quoted → credit-checked → approved → ordered → reserved → picked → dispatched → delivered with POD → invoiced → part-paid → outstanding updated → project profitability updated. **Zero re-keying at any step. Customer name typed exactly once.**

---

### Slice 2 — Godown and dispatch (6–8 weeks)

Mobile: stock count with barcode, picking, loading confirmation. Dispatch board (kanban by state). Vehicle + driver + trip. Driver app: today's deliveries, navigate, status, POD (signature + photo + GPS + timestamp), shortage/damage reporting, cash collection. Transfers between warehouses. Returns.

**Acceptance:** a full day's dispatch runs on the app with no paper challan, and physical count matches book stock after a blind count of one godown.

---

### Slice 3 — Buy and collect (6–8 weeks)

Purchase Request → PO → Goods Receipt → QC → Purchase Bill → Payment. Landed cost allocation (by quantity/weight/value). Supplier 360. Collections module + ageing buckets. Field sales app: route, visits, quotations, orders, collections, offline queue for the four permitted flows. WhatsApp send for quote/invoice/statement/receipt.

**Acceptance:** DSO measurably drops for the pilot customer over 60 days. This is the number the sale is made on.

---

### Slice 4 — Books and compliance (8–10 weeks)

Chart of accounts, automatic journals from every transaction, AR/AP, general ledger, trial balance, P&L, balance sheet, cash flow, cost centres. GST: rate resolution, HSN, tax invoices, credit/debit notes, GSTR-1/3B data extracts. E-invoice via GSP adapter. E-way bill via NIC adapter (with Ship-to GSTIN, 180-day guard, closure). **Tally export adapter** (see A3).

**Acceptance:** a chartered accountant files a full month's GSTR-1 from MaterialOS output without touching Tally, and the trial balance ties.

---

### Slice 5 — Intelligence (6–8 weeks)

Read-only AI assistant over a registered tool set. Document reader (supplier invoice → draft purchase bill, human-reviewed). Reorder engine. Ageing/slow-moving/dead stock. Collection prioritisation with stated reasons. Demand forecast (start with a seasonal-naive baseline and only replace it if it beats that baseline on held-out data — do not start with an LLM).

**AI tool contract:** every tool declares name, input schema, output schema, required permission, tenant scope, `mutates: false`, cost budget. Every invocation logs user, prompt, tools called, rows read, result, latency, cost. Refuse rather than guess. An eval set of 100 questions with known answers runs in CI; regressions block release.

**Acceptance:** "Who owes us the most and why is it overdue?" is answered correctly, with drill-through to the underlying invoices, in under 5 seconds.

---

### Slice 6 — Customer ecosystem (6 weeks)

Customer portal: orders, invoices, outstanding, statements, delivery tracking, quote approval, PO upload, payment. Notification centre. Approval workflows (configurable, table-driven).

---

## PART G — Agent operating rules

**G1. Definition of done.** A module is done when: schema + migration + RLS policy + API + Zod/Pydantic validation + permission check + audit + error taxonomy + loading state + empty state + error state + mobile behaviour (where applicable) + OpenAPI docs + unit tests on rules + one integration test on the happy path + one on the primary failure path. Screens without backing rules are not progress.

**G2. Ambiguity default.** When the spec is silent, choose the option that (a) preserves an invariant in Part B, then (b) is simpler, then (c) is reversible. Record it in `docs/decisions/ADR-NNN.md` in five lines: context, options, choice, consequence, reversibility. Do not stop to ask unless the choice is expensive and irreversible.

**G3. Vertical only.** Never build a screen without its endpoint. Never build an endpoint without its rule. Never build a rule without its test.

**G4. Test proportionality.** Property-based tests for ledgers, money and conversions. Integration tests for workflows. E2E only for the golden transaction and POS. Do not write E2E tests for CRUD screens — they are the flakiest, least valuable tests in the suite. Full regression: nightly and pre-release, not per-commit.

**G5. Errors are typed.** `{ error: { code, message, details, retryable } }` with a code enum shared between backend and frontend. `CREDIT_LIMIT_EXCEEDED`, `INSUFFICIENT_STOCK`, `PERIOD_LOCKED`, `GSTIN_INVALID`, `EWB_DOCUMENT_TOO_OLD`. UI maps codes to recovery actions. "Something went wrong" is a build failure.

**G6. Seed data must be real.** Sri Balaji Building Materials, 3 branches (Visakhapatnam, Vijayawada, Hyderabad), 400 items across 9 categories with correct current HSN and GST rates, 18 months of transactions with realistic seasonality (monsoon dip Jun–Sep, festival spike Oct–Nov), a believable receivables ageing curve, and three projects mid-delivery. Generated by a script, deterministic by seed, regenerable.

**G7. Performance budget, enforced.** p95 < 400ms for list endpoints at 1M invoice rows. Every list endpoint is keyset-paginated (not OFFSET). Every foreign key is indexed. A query plan test fails the build on any sequential scan over a table >100k rows in a hot path.

**G8. What to refuse.** If asked to add a feature not in the current slice, add it to the backlog and say so. Scope creep in slices 0–3 is the primary failure mode of this project.

---

## Appendix — Backlog

The full v1 feature set, held for after Slice 6. These are **candidates**, not requirements; each must earn its place against Part A's three wedges before it is built.

**Inventory/warehouse:** zones and rack topology beyond bins, cycle counting schedules, blind-count variance workflows, serial numbers, stock ageing dashboards per batch, yard/outdoor storage modelling.

**Logistics:** weighbridge integration (gross/tare/net + weighment ticket), load planning optimisation, vehicle fuel and maintenance registers, trip costing, driver settlement, route optimisation, GPS live tracking.

**Sales/CRM:** lead pipeline with probability weighting, opportunity forecasting, contractor commission schemes, referral tracking, the owner/builder/contractor/engineer/architect relationship graph, salesperson beat plans and geo-fenced check-ins.

**Projects:** material requirement planning per project, consumption-rate forecasting, project profitability roll-ups, drawing/BOQ attachment.

**Intelligence:** AI pricing recommendations, voice order capture (Telugu/Hindi — note that this needs a domain-tuned ASR; generic Whisper does not handle "12mm Tiscon" reliably), proactive business copilot alerts, supplier price-trend comparison.

**Ecosystem:** supplier portal, digital catalogue with shareable links, online ordering, payment gateway, marketplace integrations.

**Platform:** visual report builder, OpenSearch, BI cube layer, SSO/SAML, webhooks and partner API, multi-currency, advanced enterprise RBAC, Kubernetes deployment, distributed tracing.

**Desktop:** Tauri builds for Windows/macOS/Linux, thermal and A4 print pipelines, cash drawer, scale integration.

---

## Three decisions to make before writing code

1. **nirmaanOS relationship** — A, B or C from §A5. Everything about the repo layout depends on it.
2. **Pilot customer, named** — a real dealer who will give you their Tally file in week 3 and use Slice 1 in week 14. Without one, the slice acceptance tests are self-graded and meaningless.
3. **The name** — check "MaterialOS" for existing trademark and domain availability in class 9/42 before it is in the codebase, the schema and the app stores.
