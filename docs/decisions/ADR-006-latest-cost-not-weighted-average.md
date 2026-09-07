# ADR-006: Item cost is "latest landed cost", not weighted-average or FIFO

**Context:** Slice 3 introduces real purchases with landed cost
(freight/handling allocated across a goods receipt). Every ERP has to
pick an inventory costing method -- FIFO, weighted-average (WAC), or
simplest of all, "the last price paid." The brief does not mandate one.

**Options:**
- FIFO: cost pulled from the oldest unconsumed batch. Correct for tax
  purposes in many jurisdictions, but needs batch-level cost tracking
  wired through every consuming transaction (sale, adjustment, transfer).
- Weighted-average: `Item.standard_cost` recomputed as a running average
  weighted by quantity on each receipt. More accurate than "latest," but
  needs the qty-on-hand at receipt time, and drifts if stock ever goes
  negative (which B3/B4 already forbid, so this is less risky than it
  sounds).
- Latest cost: each goods receipt's landed unit cost simply overwrites
  `Item.standard_cost`.

**Choice:** Latest cost, for now. It requires no additional state, no
new invariant, and it's what an owner pricing by "what did I just pay"
actually does day to day. Batches already carry their own `cost` field
(Slice 1's `Batch` model) for when batch-level costing becomes real
requirement.

**Consequence:** Margin figures shown on quotes/invoices reflect the
most recent purchase cost, not a true weighted average -- overstating
margin on old stock bought cheaper, understating it on old stock bought
dearer. Acceptable for Slice 3; revisit if margin accuracy on
slow-moving stock becomes a real complaint.

**Reversibility:** Reversible. Switching to WAC is a change inside
`services/procurement.py`'s landed-cost step only -- nothing downstream
(quotes, invoices, margin display) needs to know which method produced
`Item.standard_cost`.
