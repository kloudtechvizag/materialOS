# ADR-007: E-invoice and e-way bill adapters ship sandbox-only

**Context:** D2/D4 require e-invoice (IRN) generation via a GSP/ASP
adapter and e-way bill generation via an NIC adapter, each behind a
swappable interface with sandbox and live implementations. Live
implementations need real credentials this environment doesn't have:
a contracted GSP (e.g. ClearTax, Cygnet) or direct NIC e-invoice/e-way
bill API access, both of which require GST registration, API keys, and
a production onboarding process specific to the dealer's own GSTIN.

**Options:**
- Fabricate a "live" implementation that fakes success responses.
- Build the adapter interface plus a real, deterministic sandbox
  implementation, and a live implementation that is structurally
  complete (same interface, same request shape) but raises a clear
  `NotConfiguredError` until real credentials are supplied via
  environment configuration.

**Choice:** The second option -- same reasoning as Slice 3's WhatsApp
gap (ADR omitted there only because it needed no code at all). A fake
"live" adapter that returns success would let a real invoice go out the
door believing it has a legally valid IRN when it does not; that is a
compliance failure Part D exists specifically to prevent, not a
convenience to fake past.

**Consequence:** `app/einvoice/gateway.py` and `app/ewaybill/gateway.py`
define the interface once; `SandboxGateway` generates realistic
deterministic IRNs/EWB numbers and QR payloads entirely locally, useful
for demos, tests, and UI development. `LiveGateway` is wired to the same
interface and raises immediately with a message naming exactly which
config value is missing, so switching a real tenant to production is a
config change, not a code change.

**Reversibility:** Reversible by construction -- that is the entire
point of the adapter interface D4 mandates.
