# ADR-042: Fee payment gateway — reused the platform's existing sandbox/live PaymentProvider, not a new integration pattern

**Context:** the third of four deferred items picked back up this
pass. ADR-031 named "Online payment gateway integration —
`Receipt.mode` already accepts `upi`/`card` for a staff-entered
payment, but no gateway webhook exists"; ADR-032 named "Fee payment
from the portal... 'Record payment' stays a staff-only action." Unlike
SMS/WhatsApp (still genuinely blocked — no provider credentials exist
in any environment this runs in, and unlike a payment order there is
no honest way to sandbox actually delivering a message), a payment
gateway **already has a real, working sandbox** on this platform:
`app/billing/gateway.py`'s `PaymentProvider` abstraction (ADR-007/
ADR-014), built for MaterialOS's own subscription billing. A
deterministic sandbox provider and a live Razorpay-shaped provider
that raises `NotConfiguredError` until real credentials
(`RAZORPAY_KEY_ID` etc.) are set already exist and are already
exercised end to end by `test_billing_flow.py`. This ADR reuses that
exact abstraction for fee collection rather than inventing a second
payment pattern.

## What shipped

**`FeePayment`** (migration `b3c4d5e6f7a8`) is a field-for-field
mirror of `SubscriptionPayment` (`models/subscriptions.py`), plus one
addition: `receipt_id`, linking a succeeded payment to the real
`Receipt` it produced.

**`services/fee_payment.py`** mirrors `billing/service.py`'s own
`checkout` → `handle_webhook` → (sandbox) `simulate_payment_result`
shape exactly:
- `checkout` is guardian-scoped (`_owned_student`, reused from
  `guardian_portal.py`) and orders the real, currently-outstanding
  balance (`_invoice_outstanding`, reused from `services/fees.py`) —
  not the original invoice total, so a partially-paid invoice can
  still be paid the rest of the way.
- `handle_webhook` is the *only* place a `FeePayment` is ever marked
  succeeded — on success it calls `record_receipt` (reused from
  `services/receipts.py`, the exact same function the staff-entered
  receipt flow already uses) to post a real `Invoice`-allocated
  `Receipt`, not a parallel "online payment" ledger entry. Idempotent:
  a replayed webhook event on an already-terminal payment is a no-op.
- `simulate_payment_result` is the same sandbox-only dev/demo helper
  `billing/service.py` already established — it still goes through
  `handle_webhook`, and refuses outright if a live provider is ever
  configured.

**API**: `POST /guardian-portal/children/{id}/fees/{invoice_id}/
checkout` and `POST /guardian-portal/fee-payments/{id}/simulate`
(guardian-authenticated); a separate, unauthenticated, signature-
verified `POST /fee-payments/webhooks` for the real gateway's own
callback — deliberately its own endpoint, not reusing `/billing/
webhooks`, since `FeePayment` and `SubscriptionPayment` are two
separate `provider_order_id` spaces.

**Frontend**: the Guardian Portal's Fees card gained a real "Pay now"
button per invoice with an outstanding balance. In this environment
(`settings.environment != "production"`), `get_payment_provider()`
always returns the sandbox, so every checkout surfaces an honest
"Sandbox order created... no real gateway is configured" panel with
Simulate success/failure buttons — never a fake "payment succeeded"
message dressed up as real.

## Deliberately not built in this pass

- **A live Razorpay Checkout.js widget** — unreachable and
  unverifiable in any environment this runs in (no real gateway
  account exists); when real credentials are configured,
  `get_payment_provider()` already switches to `LivePaymentProvider`
  server-side with zero code change, but the frontend's real-provider
  checkout UI is genuinely separate, untestable work, named rather
  than built speculatively.
- **Partial payment amounts from the portal** — checkout always orders
  the full current outstanding balance; a guardian can't choose to pay
  ₹2,000 of a ₹5,000 balance from the portal (staff can, via the
  existing `/receipts` endpoint).
- **Refunds** — `SubscriptionPayment`'s own status vocabulary includes
  `refunded`/`partially_refunded`; `FeePayment` deliberately doesn't,
  since no refund flow exists yet on either side of this abstraction.

## Verification

7 new backend tests (`test_fee_payment.py`), all through the real HTTP
API, mirroring `test_billing_flow.py`'s own coverage shape: checkout
orders the real outstanding amount (not a hardcoded guess); a student
not owned by the guardian is rejected (404); simulating success
creates a real Receipt and clears the outstanding balance exactly;
simulating failure leaves the balance untouched; paying an
already-fully-paid invoice is rejected; a bad webhook signature is
rejected (401); and a direct webhook call with a valid sandbox
signature is idempotent on replay (no duplicate Receipt). Full backend
suite: 311 passed, zero regressions.

Live-verified against the real `greenwood-demo` tenant end to end,
including in the browser: Aarav Mehta's real ₹15,000 outstanding
invoice (`INV-2026-27-000002`) → guardian clicks "Pay now" → real
sandbox order (`SANDBOX_order_...`) for exactly ₹15,000.00 → "Simulate
success" → the Fees card updates live to a "Paid" badge. Confirmed on
the staff side: a real `RCPT-2026-27-000002` receipt for ₹15,000.00,
mode `upi`, now exists via `GET /receipts` — the exact same document a
staff-entered payment would produce. Confirmed the fix flows through
to Analytics too: fee collection moved from 6.7% (₹5,000 of ₹75,000)
to 26.7% (₹20,000 of ₹75,000) on the live dashboard, with no code in
`services/analytics.py` touched by this ADR at all — proof the new
Receipt is a real accounting row, not a UI-only illusion.

## Reversibility

Fully additive: one new table, three new endpoints, one reused
abstraction. `handle_webhook`'s only side effect on success is calling
the platform's own pre-existing `record_receipt` — reverting this ADR
means removing the checkout/webhook endpoints; every Receipt it ever
created remains a completely ordinary, real accounting record
indistinguishable from a staff-entered one.
