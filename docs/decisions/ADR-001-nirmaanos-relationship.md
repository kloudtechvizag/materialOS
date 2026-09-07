# ADR-001: nirmaanOS relationship

**Context:** Master Brief v2 §A5 requires this decision before Slice 0 because it determines repo layout, auth/tenancy sharing, and release coupling between MaterialOS and nirmaanOS.

**Options:**
- A — Separate products, shared nothing. Fastest to ship, no coupling.
- B — Shared platform (auth, tenancy, products, documents), two product surfaces. Saves ~3 months on a second product, costs ~6 weeks up front, couples release cycles permanently.
- C — Shared platform plus a network layer (RFQ handoff between products). Highest ceiling, but only after both products have paying customers.

**Choice:** Option A. No nirmaanOS codebase exists yet and no customer has asked for the link. This repo (`materialOS`) is standalone: its own auth, tenancy, and database. No shared package boundary is reserved for a second product.

**Consequence:** If nirmaanOS is built later, integration happens via MaterialOS's public API (Option C path), not a shared monorepo package. Revisit only when both products have paying customers, per §A5.

**Reversibility:** Reversible. Extracting shared auth/tenancy into a library later is refactoring work, not a rewrite, because RLS-based tenancy (B9) and the API-first rule (§72) already force clean boundaries.
