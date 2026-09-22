# ADR-038: Education webhook events — reused the existing push-based integration system, added no new one

**Context:** the second Phase 7 slice (Multi-campus remains; AI Copilot
skipped by request). "Integrations" in the original roadmap could mean
either direction: MaterialOS *calling out* to a third-party API with
our own credentials (SMS gateways, payment gateways, biometric
devices), or MaterialOS *pushing* real business events to a URL the
tenant configures themselves. Every instance of the first kind has
already been explicitly deferred throughout this vertical — "no real
credentials exist" is why the WhatsApp send in Slice 3, the biometric/
RFID hooks named in ADR-027/034, and every notification channel beyond
email (ADR-013) are stubs or refuse-until-configured. That constraint
doesn't move for this slice either. The second kind needs nothing from
us but a URL and a signature — the tenant holds the destination and its
credentials, not MaterialOS — and this platform already has a complete,
generic implementation of it: `WebhookSubscription`/`WebhookDelivery`
(`services/webhooks.py`), a fixed `REAL_EVENTS` catalog, HMAC-signed
delivery with retry/dead-letter, and a fully dynamic settings page
(`WebhooksPage.tsx`) that renders whatever `REAL_EVENTS` lists with no
per-event frontend code. Two events already exist for the core sales
flow (`sales_order.created`, `invoice.created`). This slice is entirely
about extending that same catalog to the education domain.

## What shipped

Four new entries in `REAL_EVENTS`, each emitted from the one real
service-layer call site that makes the event true — the same
`emit_event(db, tenant_id=, event_type=, payload=)` call already used
in `sales_order.py`/`invoicing.py`, added inline, in the same
transaction as the write that produced the event:

- **`student.enrolled`** — `services/education.py::create_student`.
  Fires once whether a student is admitted directly or converted from
  an admission application (`convert_application_to_student` calls
  `create_student` internally) — one canonical emission point, not two
  parallel ones that could drift.
- **`fee_invoice.generated`** — `services/fees.py::generate_fee_invoices`,
  once per invoice created in the batch, mirroring `invoice.created`'s
  own per-invoice granularity rather than one event per batch call.
- **`examination.results_published`** — `services/examinations.py::
  set_examination_lock`, only on a real `False -> True` transition, not
  on every call to the lock endpoint (a redundant re-lock, or an
  unlock, fires nothing). Locking is the real "finalized, and marks can
  no longer be edited" moment for an examination — the honest
  equivalent of "published."
- **`admission.enquiry.created`** — `services/admissions.py::
  create_enquiry`, the top-of-funnel event a school's own CRM or
  marketing tool would want, distinct from `student.enrolled` since
  most enquiries never convert.

**Zero new tables, zero new API endpoints, zero new frontend code.**
`WebhooksPage.tsx` already fetches `GET /webhooks/events` and renders a
checkbox per catalog entry; the four new events appear there the
moment they exist in `REAL_EVENTS`, with no page change. Subscription
management, HMAC signing, retry/dead-letter, and delivery history were
all already generic and untouched by this slice.

## Deliberately not built in this pass

- **Attendance events** — `student_attendance.bulk` fires once per
  section per day; a school with many sections would produce a high-
  frequency event with no obvious external consumer beyond what
  Analytics (ADR-037) already surfaces on read. Not wired; can be added
  the same one-line way if a real need shows up.
- **Transport/library/hostel events** — no clear external system a
  school would wire these to that isn't better served by the Analytics
  dashboard's on-read numbers; skipped rather than adding events for
  the sake of catalog size.
- **Outbound integrations requiring MaterialOS-held credentials** (SMS,
  payment gateway callbacks, biometric attendance devices) — unchanged
  from every prior deferral in this vertical; still blocked on "no real
  credentials exist," and this slice doesn't touch that boundary at
  all, since a webhook is the tenant's credential, not ours.

## Verification

3 new backend tests (`test_education_webhook_events.py`), all through
the real HTTP API: the four events appear in the real catalog; a
subscription covering all four actually receives one `WebhookDelivery`
row per real action (enquiry creation, student enrollment, fee invoice
generation, exam lock) with `status == "pending"` (queued, not
delivered, since no Celery worker runs in the test process — the same
convention `test_webhooks.py` already established); and a redundant
re-lock on an already-locked examination fires nothing, proving the
transition check and not just "was `is_locked=True` in the request."
Full backend suite: 301 passed (298 + 3 new), zero regressions. `docker
exec` import check confirmed no circular imports introduced by
`education.py`/`fees.py`/`examinations.py`/`admissions.py` each
importing `services.webhooks`.

## Reversibility

Fully additive and the smallest-blast-radius slice in this vertical so
far, smaller even than Analytics (ADR-037): no new table, no new
migration, no new permission resource (webhook management already has
its own), no new frontend file. Each `emit_event` call sits at the end
of an already-committed code path and can be deleted independently of
the other three with no shared state to unwind.
