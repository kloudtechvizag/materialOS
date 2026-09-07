# ADR-003: Dynamic item parameters as JSONB, not EAV tables

**Context:** dev.md §12 and the Master Brief require item parameter sets
(grade, diameter, heat number, tile size, etc.) to be admin-configurable
per category rather than hardcoded per product type. v1's DB sketch
(§74) lists `ProductParameter`/`ProductParameterValue` as separate
entities, i.e. a classic EAV design.

**Options:**
- Full EAV: `ProductParameter` (per-category schema) + `ProductParameterValue`
  (per-item values) as normalized tables.
- `Category.parameter_schema JSONB` (list of `{name, type, unit}`) +
  `Item.attributes JSONB` holding the actual values.

**Choice:** JSONB. EAV buys type-safe per-attribute querying and
indexing that nothing in Slices 1-3 actually needs yet (no attribute
-based faceted search or reporting is in scope before the backlog's
"report builder"). JSONB is simpler to write and simpler to read, and
Postgres's `jsonb_path_ops` GIN index gives adequate query performance
if a specific attribute search becomes a real requirement later.

**Consequence:** Category-specific validation (e.g. "TMT items must have
a diameter") happens in application code against `parameter_schema`,
not via foreign-keyed rows. B2 (quantity always carries `(value, uom,
product_id)`) is unaffected -- that's handled by `UnitConversion` and
`convert()`, not by the parameter storage shape.

**Reversibility:** Reversible. A migration can unpack `Item.attributes`
into EAV rows later without any data loss if per-attribute querying
becomes a real, measured need.
