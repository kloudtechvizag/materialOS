# ADR-014: Pricing, subscription, entitlement, usage, and billing as a shared platform layer

**Context:** the directive is explicit and repeated: "Do not build a
pricing page. Build the MaterialOS monetization platform," with a
6-plan tier structure, an entitlement engine (`hasFeature()`/
`hasLimit()`, never `if plan == "growth"`), usage metering with soft/
hard limits, upgrade/downgrade with proration, a payment-provider
abstraction, webhook-verified activation, and admin-configurable
pricing rather than hardcoded frontend numbers. The spec's own §85
"Implementation priority" phases this work (Plan/entitlement/pricing
API -> subscription/usage/upgrade-downgrade -> payment/webhooks/
invoices/GST -> trials/coupons/add-ons/dunning -> admin console/
analytics -> industry packs/AI credits). This pass builds Phases 1-3
as real, load-bearing code plus the parts of 4 (add-ons, trials, a
grace-period state machine) that were cheap once the core existed;
Phases 5-6 (a full admin pricing console, MRR/ARR analytics, AI
credits, printing-specific usage meters) are named and deferred below,
not faked.

## Data model: platform catalog vs. tenant-scoped billing

Same split as `IndustryProfile` (ADR-010) and `Permission`
(`services/permissions.py`): `Plan`/`Feature`/`PlanFeature`/
`PlanLimit`/`AddonOffering` (`models/billing_plans.py`) carry no
`tenant_id` and need no RLS -- they're MaterialOS's own product
configuration. `Subscription`/`SubscriptionAddon`/`UsageRecord`/
`BillingAddress`/`SubscriptionInvoice`/`SubscriptionInvoiceItem`/
`SubscriptionPayment` (`models/subscriptions.py`) are tenant-scoped,
RLS+audit like every other tenant table.

**`SubscriptionInvoice`/`SubscriptionInvoiceItem`/`SubscriptionPayment`
are deliberately not named `invoices`/`invoice_items`/`payments`** --
those tables already exist (Slice 1) and mean a tenant's own bills to
*their* customers. This is MaterialOS's bill to the tenant. Conflating
the two would be a real correctness bug (a subscription invoice
counted as the tenant's own AR), not just a naming nitpick.

**Plan "versioning" (spec §43-44) is a new `Plan` row sharing a `slug`
with a higher `version`,** not a mutable price on an existing row. A
`Subscription` FKs to one specific `Plan` row, so a price change never
retroactively reprices an existing subscriber; `is_current` marks
which version new signups/upgrades see. `AddonOffering` -> a
purchased `SubscriptionAddon` follows the identical pattern (the
addon's price/feature/limit are snapshotted onto the `SubscriptionAddon`
row at purchase time).

## The entitlement engine (spec §14, §82)

`services/entitlements.py` is the one place every feature/limit check
goes through: `has_feature()`, `has_module()` (an alias for
`module.<name>` features), `effective_limit()`, and the FastAPI
dependency `require_feature()` -- the server-side twin of
`<FeatureGate/>`. `ENTITLED_STATUSES = {trialing, active, past_due,
grace_period}` is deliberately generous: a late renewal doesn't yank
every feature out from under a tenant the instant it's due (spec §29's
"restricted according to policy" is enforced by *usage limits*, which
are hard-gated, not by pulling entitlements the moment a payment is
late).

**Real, wired-up enforcement points** (not just configuration that
looks enforced but isn't):
- `require_feature("module.pos")` on `POST /pos/sales`.
- `require_feature("module.fleet")` on `POST /fleet/trips`.
- `enforce_quota("users", ...)` on `POST /users` -- a live `COUNT(*)`,
  not a period meter, so deactivating a user frees a seat immediately.
- `enforce_meter("invoices_per_month", ...)` on
  `POST /sales-orders/{id}/invoice`.

Every other `LIMIT_KEY` (companies, branches, warehouses, customers,
suppliers, items, purchase/sales orders per month, API calls, storage,
AI requests) is real, seeded, admin-visible configuration, and shows
correctly on the usage dashboard (`GET /subscription/usage`'s
`enforced` flag says so per-row) -- but is **not yet a blocking gate**.
Wiring the remaining call sites (branch/warehouse creation, PO/SO
creation) is mechanical repetition of the same two patterns above, not
a design gap; it wasn't done everywhere because most of those create
endpoints live deep in modules this pass didn't otherwise touch, and
touching them only to add a limit check risked more blast radius than
the two call sites actually chosen prove the architecture.

## Usage metering (spec §16-19)

`services/usage.py` splits limits into two honestly-different
mechanisms rather than forcing one abstraction over both:
- **Quota** (`enforce_quota`) -- a live `COUNT(*)` against the real
  table at the moment of creation.
- **Meter** (`enforce_meter`) -- a monotonic `UsageRecord` counter for
  the subscription's *current billing period*, checked before
  recording so a blocked call is never counted.

Both share the same soft/hard-limit policy and the same near-limit
notification hook: crossing 90% or 100% of a limit calls
`fire_trigger()` (ADR-013's notification rule engine, reused, not
reimplemented) with `usage_near_limit`/`usage_limit_reached` -- both
added to `notification_rules.DEFAULT_RULES` alongside
`trial_ending`/`payment_failed`/`subscription_renewed`/
`subscription_cancelled`, so a brand-new tenant is subscribed to all
of this by default the same way `stock_low` already was.

## Subscription lifecycle (spec §22-29, §47)

`services/subscriptions.py`'s state machine:
`trialing -> grace_period -> expired`, `active -> past_due` (on
renewal invoice generation) `-> grace_period -> expired`,
`cancel_at_period_end` reaching the period end `-> cancelled`, and any
state `-> active` on a real webhook-verified payment (see below). A
daily Celery beat task (`billing_tasks.run_subscription_lifecycle_task`,
mirrors ADR-013's `run_scheduled_backups_task` per-tenant iteration
exactly) drives the automatic transitions; `GRACE_PERIOD_DAYS = 7` is
a single constant, not yet an admin-configurable per-tenant policy
(spec §29 names 3/7/14 as options) -- recorded as deferred, not
silently picked.

**Downgrade is usage-gated, upgrade is not** (spec §24). Before a
downgrade is allowed, `check_downgrade_blockers()` compares every
*quota*-style limit (not meter-style -- those reset every period
anyway, blocking on them would be meaningless) against the target
plan and returns a 409 with the exact violations
(`{limit_key, current, new_limit}`) if any are exceeded. Nothing is
ever silently deleted or deactivated to force a downgrade through.

**Proration (spec §25) only applies to a genuinely paid, `active`
subscription.** Caught by live verification, not a test: an early
version amortized the *old* plan's full annual price over whatever
`current_period_start`/`current_period_end` happened to be, and for a
still-`trialing` subscription that window is the 14-day trial, not a
paid year -- amortizing ₹38,390 over 14 days fabricated an enormous,
wrong credit. Fixed by skipping proration entirely for any non-`active`
status: a plan change during a trial (or `past_due`/`grace_period`,
where the current period was equally never paid for) is free, and the
next real invoice simply bills whatever plan is current when it's
generated. A net-negative proration result (a downgrade credit) is not
carried forward to a future invoice in this pass -- the zero/negative
case correctly returns no invoice rather than fabricating a credit
note, but an actual credit-application mechanism is deferred.

## Payments: a provider abstraction, sandbox by default (spec §30-32, §61)

`app/billing/gateway.py` mirrors ADR-007's e-invoice gateway exactly:
a `PaymentProvider` ABC, a real deterministic `SandboxPaymentProvider`
(no network call, `SANDBOX_`-prefixed ids so a sandbox order can never
be mistaken for a real one), and a `LivePaymentProvider` that raises
`NotConfiguredError` until `RAZORPAY_KEY_ID`/`_SECRET`/
`RAZORPAY_WEBHOOK_SECRET` are set **and** `environment == "production"`.
No fake "live" success on a payment, same reasoning as never faking a
live e-invoice IRN.

**Activation is webhook-driven even in sandbox mode.** `checkout()`
only ever creates a `pending` `SubscriptionPayment`; nothing marks a
payment or its subscription as succeeded except `handle_webhook()`.
The sandbox-only `POST /billing/checkout/{id}/simulate` endpoint (dev/
demo helper standing in for the gateway's real async callback) calls
the *same* `handle_webhook()` a real Razorpay POST would hit -- there
is no separate "just trust the frontend" code path. `handle_webhook()`
is idempotent (a payment already in a terminal status is a no-op, live-
verified by replaying the identical signed payload twice and confirming
only one payment row exists) and signature-verified
(`X-Webhook-Signature`, HMAC -- live-verified with both a garbage
signature, rejected 401, and a correctly-signed sandbox payload,
accepted).

**Multi-tenant webhook routing uses payload metadata, not RLS
inference.** A webhook has no bearer token, so `tenant_id` travels in
the event payload itself (as it would in Razorpay's own `notes`
metadata, echoed back verbatim) and the handler sets RLS context from
it before any query. This is the realistic shape of how a real
Razorpay integration would carry tenant identity through the gateway,
not a shortcut invented for the sandbox.

## GST on MaterialOS's own invoices (spec §33-35)

`services/subscription_billing.py::calculate_platform_gst()` is a
small, separate function from `app/tax/resolve.py`'s `resolve_tax()`
-- that one is keyed off an `Item.gst_rate` for a tenant's *own* sales
and doesn't apply here. Platform billing uses a single configured rate
(`settings.platform_gst_rate`, default 18%, software services) and
compares the tenant's `BillingAddress.state` against
`settings.platform_state` for CGST+SGST vs. IGST -- an unset billing
address defaults to IGST (the safer assumption when the tenant's state
is genuinely unknown). **Not posted into the tenant's own chart of
accounts/journal** -- treating MaterialOS's own SaaS fee as one more
of the tenant's booked business transactions is a real, separate
accounting integration this pass doesn't build.

## Frontend (spec §51-57, §65-66)

`/pricing` is public (hero, monthly/yearly toggle defaulting to
yearly, plan cards, a collapsible full compare table, add-ons, an
enterprise CTA, FAQ) and reads every price/limit/feature from
`GET /pricing/plans|compare|addons` -- nothing is hardcoded in React.
`Settings -> Subscription` (+ `/invoices`, `/payments` sub-routes)
shows current plan, status, usage bars (color-coded at 75%/90%/100%,
an explicit "not yet enforced" label on informational-only limits),
and every action the backend supports (upgrade, downgrade with the
violation list surfaced inline on a 409, cancel, reactivate, checkout
with the sandbox simulate buttons). `<FeatureGate/>` and
`<UsageLimitGate/>` (spec §55-57) are built and wired onto one real
route (`/pos`, matching the backend's own `module.pos` gate) as the
concrete proof of the pattern -- wrapping every other gated route is
the same mechanical repetition noted above for backend enforcement,
not a design gap.

## Explicitly deferred (backlog, not this pass)

- **A full admin pricing console** (spec §42) with plan/price/coupon
  CRUD and a UI for versioning. Editing the catalog today means
  editing `PLAN_DEFINITIONS`/`FEATURE_CATALOG`/`ADDON_CATALOG` in
  `services/billing_plans.py`, same as every other catalog seeder in
  this codebase (`PROFILE_DEFINITIONS`, `RESOURCES`) -- a real,
  working mechanism, just not yet a self-serve UI. This also blocks on
  a genuine gap this pass surfaced but didn't solve: there is no
  "MaterialOS employee" identity/auth concept in this app at all
  (today's RBAC is entirely per-tenant) -- a cross-tenant admin console
  needs one, and inventing platform-operator authentication is a
  separate, security-sensitive feature of its own.
- **Coupons/discounts, referral/partner pricing** (spec §45-46).
  `SubscriptionInvoice.discount_amount` exists as a real column so the
  door is open, but no redemption/eligibility logic was built.
- **Per-tenant-configurable grace/dunning schedule** (spec §29, §39) --
  `GRACE_PERIOD_DAYS = 7` is a single constant today.
- **A carried-forward downgrade credit** -- a net-negative proration
  result currently just means "no invoice," not "credit applied to the
  next one."
- **WhatsApp/SMS/push billing notifications, MRR/ARR/churn analytics,
  an enterprise-lead CRM/Leads capture form** (spec §58 partially,
  §67-70) -- the notification *rules* exist and fire in-app (ADR-013's
  channel set), but the extra channels and the analytics dashboard
  need infrastructure (a WhatsApp Business API contract, a leads
  table + sales workflow) this pass didn't stand up, same reasoning as
  every other "no fake credentials" deferral in this project.
- **AI credits/AI-specific usage metering** (spec §72) -- no AI
  assistant exists yet (Slice 5 is not started); `ai_requests_per_month`
  is real, seeded, per-plan configuration with nothing behind it to
  meter yet.
- **Printing-specific usage meters** (pages/sheets/sq ft/machine hours,
  spec §71) and **storage metering tied to actual `storage_data/`
  usage** (spec §73) -- both are real `LIMIT_KEYS`/meter-shaped
  concepts already in the catalog, wiring an actual page-count or
  byte-count capture point into the Printing/backup modules is a
  follow-up, not attempted here to keep this pass's blast radius to
  the core billing engine.
- **Multi-currency/multi-region** -- `currency` is a real column
  (`INR` only, everywhere) with no conversion logic.

## Bugs found only by live verification against the running containers

Consistent with this project's standing practice, three real bugs
surfaced only by actually calling the new endpoints end to end, not by
the unit test suite:

1. **Proration during a trial fabricated a huge, wrong credit** (see
   above) -- an in-trial upgrade produced a multi-thousand-rupee
   "credit" that happened to net to no charge in the first case tried,
   which is exactly the kind of silent-until-it-isn't bug that only
   shows up by actually calling the endpoint with a real trial
   subscription. Fixed by gating proration on `status == "active"`.
2. **`SubscriptionInvoiceOut.model_validate({**invoice.__dict__, ...})`
   raised a pydantic `ValidationError` on a freshly-flushed invoice** --
   `invoice.__dict__` only contains attributes SQLAlchemy has actually
   populated on the Python instance, which excludes a nullable column
   like `paid_at` that was never explicitly set (it's `None` via the
   class-level descriptor, reachable through `getattr()`/
   `from_attributes`, but not present in `__dict__` yet). Fixed by
   validating from the object itself (`from_attributes`-style) and
   attaching `items` afterward via `model_copy`, rather than blindly
   merging `__dict__`.
3. **`reactivate_subscription()` had no guard against being called on a
   subscription that was never cancelled** -- calling it on an
   ordinary `trialing` subscription would generate a bogus full-price
   "Reactivation" invoice. Caught while writing the HTTP-level test for
   the checkout/webhook flow (the natural test sequence -- upgrade,
   then reactivate -- exposed it immediately). Fixed with an explicit
   status check that raises `VALIDATION_ERROR` (409) unless the
   subscription is actually `cancelled`/`expired`/`suspended`.
4. **New resources (`subscription`, `billing`) added to
   `services/permissions.py::RESOURCES` would have repeated the exact
   bug fixed earlier this session** (existing tenants' owner roles
   never receiving newly-added permission codes) -- pre-empted this
   time with a second backfill migration
   (`c7e1a49f0b6d_backfill_billing_permissions.py`) in the same change
   that added the resources, rather than waiting for it to be reported
   again.

None of the four were caught by the unit test suite -- each test signs
up its own fresh tenant and drives a short, deliberate sequence, which
doesn't naturally exercise "upgrade while trialing" -> "reactivate
right after" or a genuinely lapsed pre-existing tenant's permission
set. Reaffirms this project's standing verification discipline: run
the actual HTTP requests against the live, Postgres-backed containers,
not just the mocked/isolated unit suite.
