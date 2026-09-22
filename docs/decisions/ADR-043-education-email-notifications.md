# ADR-043: Education email notifications — reused the platform's existing notification-rule engine, and named why SMS/WhatsApp still can't be

**Context:** the last of four deferred items picked back up this pass
("PDF export, payment gateway, SMS/WhatsApp, file attachments" — see
ADR-040/041/042 for the other three). Every education ADR from
ADR-027 onward named the same gap the same way: "depends on the
not-yet-built Communication Center (Phase 5)" and, once ADR-033 shipped
that, "SMS/email/WhatsApp/push delivery... in-app is the one real
channel." That framing undersold what already existed platform-wide:
`services/notification_rules.py`'s `fire_trigger` (ADR-013, already
reused by Billing/ADR-014 and HR-Payroll/ADR-015) and
`services/notification_channels.py::send_email` are both **real**,
already-working mechanisms — a genuine SMTP client that honestly
reports "not configured" per attempt rather than faking success, not
a stub. Only SMS/WhatsApp/push remain genuinely absent, because no
provider credentials exist in any environment this runs in, and unlike
a payment gateway (ADR-042) there is no honest way to sandbox actually
delivering a message to a real phone number. This ADR does not change
that; it wires the two education events that clearly warranted it into
the channel that already works.

## What shipped

**Two new entries in `DEFAULT_RULES`**: `fee_invoice_generated` and
`announcement_published`, seeded at signup exactly like every other
tenant-configurable trigger already is. Conservative default —
`channels: ["in_app"]` only, matching every single existing rule in
that list (not one of the ~15 pre-existing defaults ships with `email`
on by default) — a tenant opts email in themselves, from the
already-generic, already-built `NotificationRulesPage.tsx`, once SMTP
is actually configured. **Zero new frontend code**: that admin page
already renders whatever trigger types the backend returns.

**`generate_fee_invoices`** (`services/fees.py`) now calls
`fire_trigger(..., recipient_email=guardian.email)` right next to the
`fee_invoice.generated` webhook event (ADR-038) it already emitted —
same call site, same transaction, using the `guardian` object already
resolved a few lines above for billing.

**`create_announcement`** (`services/announcements.py`) resolves the
real guardian audience for a fresh announcement's targeting
(`_announcement_audience_emails`) — the literal inverse of
`list_visible_announcements_for_guardian`'s own per-guardian scope
check, live off `Student`/`StudentEnrolment`, never a cached audience
list — and fires one trigger per guardian with a real email on file.

## Deliberately not built in this pass

- **Exam results published, homework due reminders, attendance
  alerts** — named, not wired. Exam results are already covered by the
  webhook event (ADR-038) for external integrations and are already
  live in the Guardian Portal the moment they're locked; a reminder
  needs a scheduled job (not an event-triggered one), which is real,
  separate, later work — the exact same reasoning ADR-038 already used
  to skip attendance events ("no obvious external consumer... can be
  added the same one-line way if a real need shows up").
- **A backfill migration seeding these two rules onto existing
  tenants** — deliberately not written. Every prior addition to
  `DEFAULT_RULES` (ADR-014's billing triggers, ADR-015's HR triggers)
  has the same property: `ensure_default_notification_rules` only ever
  runs at signup, and no backfill migration exists for any of them
  either. `fire_trigger` finding zero matching active rules for an
  existing tenant is graceful by the function's own design ("No
  matching active rule... means no notification, by design") — this
  ADR follows the established precedent rather than introducing a new
  one.
- **SMS/WhatsApp/push** — unchanged. Still genuinely blocked; naming
  this again explicitly rather than leaving it ambiguous whether this
  ADR quietly addressed it.

## Verification

3 new backend tests (`test_education_notifications.py`), through the
real HTTP API: a fresh signup's `GET /notifications/rules` includes
both new trigger types with the conservative `["in_app"]` default;
generating a real fee invoice for a student with a real guardian email
produces exactly one real `Notification` row (`notification_type ==
"fee_invoice_generated"`, `entity_id` == the real invoice id, the
student's name in the message); publishing a class-targeted
announcement to two students in two different classes produces
exactly one notification (Alice's guardian, whose child is in scope —
not Bob's, whose child isn't), proving the audience-resolution query
scopes correctly, not just "fires for everyone." Full backend suite:
311 passed, zero regressions.

Cross-checked against the real, pre-existing `greenwood-demo` tenant:
confirmed directly via `GET /notifications/rules` that an
already-signed-up tenant does **not** retroactively gain the two new
rules (`fee_invoice_generated`/`announcement_published` absent from
its rule list) — the expected, honest behavior for an additive,
non-backfilled default, not a bug.

## Reversibility

Fully additive: two new rows in an existing table's seed data, two
`fire_trigger` calls at existing call sites, no schema change, no new
endpoint, no new frontend file. Removing this ADR means deleting the
two `fire_trigger` calls and the two `DEFAULT_RULES` entries; nothing
else depends on them.
