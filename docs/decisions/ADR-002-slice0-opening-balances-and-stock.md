# ADR-002: Opening balances and opening stock in the Slice 0 importer

**Context:** Slice 0's acceptance test (Master Brief v2, Slice 0) requires the Tally/Busy importer to produce customer/supplier outstanding totals and opening stock that match the source system to the rupee. Full double-entry accounting (chart of accounts, journals, B5's balanced-journal invariant) and the full inventory engine (batches, bins, reservations) are explicitly Slice 4 and Slice 1/2 scope respectively -- building them now would be exactly the scope creep G8 forbids.

**Options:**
- Build the full journal/ledger and full stock-ledger-with-reservations machinery now, in Slice 0, so opening data flows through the "real" system from day one.
- Model opening balances as a plain signed `opening_balance` column on Customer/Supplier, and opening stock as a minimal append-only `StockLedger` + derived `StockBalance` projection (movement_type="opening" only), deferring journals, batches, bins, and reservations to their named slices.

**Choice:** The second option.
- Customer/Supplier opening balances: a single `opening_balance` NUMERIC(18,4) field, signed (debit = owed to us, credit = we owe), with `opening_balance_as_of`. This is pre-system data, not a transaction -- it does not need to flow through a journal because no journal exists yet.
- Opening stock: goes through a real, append-only `StockLedger` (B3 already applies -- stock must never be stored as bare truth even in Slice 0) with a single `movement_type = "opening"`, projected into `StockBalance`. Later slices add more movement types onto the same ledger; nothing here needs to change shape, only grow.

**Consequence:** B5 (every journal balances) does not yet apply to opening balances because no journal entity exists to violate it. When Slice 4 builds the chart of accounts, opening balances become the seed for each customer/supplier control account, posted as one real journal entry per master at migration time.

**Reversibility:** Reversible. `opening_balance` becomes an input to a Slice 4 migration script, not a structure that has to be torn out.
