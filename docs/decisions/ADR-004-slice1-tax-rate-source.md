# ADR-004: Slice 1 reads GST rate from Item, not an effective-dated table

**Context:** Part D (D1, D4) requires GST rates to live in effective-dated
tables (`valid_from`/`valid_to`) resolved as of the document date, specifically
because GST 2.0 changed the cement rate 28% -> 18% on 2025-09-22 and a
rate seeded before that date would otherwise silently stay wrong. That
compliance architecture (`tax/resolve_tax(document_date, place_of_supply,
item, customer) -> TaxBreakdown`) is explicitly Slice 4 scope.

**Options:**
- Build the effective-dated rate table now, in Slice 1, so `resolve_tax`
  is compliance-correct from the first invoice.
- Slice 1's `resolve_tax` reads the rate directly off `Item.gst_rate`
  (the current rate, kept current by whoever maintains the catalog) and
  only computes the CGST/SGST vs IGST split from place-of-supply.

**Choice:** The second option. `Item.gst_rate` already exists from
Slice 0's importer and is exactly "the rate as of today" -- which is
correct for Slice 1's actual users (new invoices only; nothing back-dates
across a rate change yet). Building the effective-dated table without
Slice 4's admin UI to maintain it, or GSTR extracts to consume it,
would be a table nobody can populate correctly.

**Consequence:** Every `InvoiceItem` still snapshots its own
`cgst_rate`/`sgst_rate`/`igst_rate` at creation time (already required
for auditability regardless), so historical invoices are unaffected
when Slice 4 introduces the real effective-dated table. `resolve_tax`'s
function signature matches D4's spec exactly; only its internal rate
lookup changes in Slice 4.

**Reversibility:** Reversible. Swapping the internal lookup in
`app/services/tax.py` for a table read is a one-function change; no
caller needs to know.
