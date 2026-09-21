# ADR-033: Communication Center — targeted announcements, in-app only

**Context:** the second and last piece of Phase 5, and the final item
in MaterialOS Education's entire phased plan (V1 Core SIS → V4
Intelligent School OS, all now shipped). An earlier audit of
`models/notifications.py` (done while researching ADR-032) already
established that `Notification` is tenant-wide, not per-user or
per-audience, and that email/SMS/WhatsApp/push delivery are honestly
documented as unwired stubs platform-wide — reusing it as-is for
parent communication wasn't an option; it has no concept of "this
notice is only for Grade 3's parents." This ADR builds the real
targeting model that was missing, scoped to the one channel that's
actually real end-to-end: in-app, surfaced in the Guardian Portal
(ADR-032).

## What shipped

**Two new tables** (`models/announcements.py`, migration
`d6cc3cd67d33`):

- `Announcement` — `target_type` is `school` (every guardian),
  `class`, or `section`, with the class/section validated server-side
  for internal consistency (a `class` target rejects a section id, a
  `section` target requires both and validates the section actually
  belongs to that class). Every announcement is published immediately
  on creation — no draft/scheduled-publish state (named below).
- `AnnouncementRead` — tracked per `Guardian`, not per `User`, so read
  state is the guardian's own fact and survives a future credential
  change, not tied to today's login mechanism.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`1e28cdc7beb7`) — one resource,
`"announcements"`.

**The one design choice worth naming: targeting is resolved live, not
cached.** `list_visible_announcements_for_guardian` re-derives which
classes/sections a guardian's children are (or have ever been)
enrolled in from `StudentEnrolment` on every request — the same "never
trust a cached audience list" discipline `services/guardian_portal.py`
(ADR-032) already established for ownership checks. A class-targeted
announcement from a prior academic year correctly stays visible even
after a child is promoted, since it was real for that enrolment at the
time; expired announcements (`expires_at` in the past) are filtered
out the same way.

**Reused the exact isolation pattern the class/section targeting
depends on** was verified with a real test, not just asserted: two
separate families in two different classes, one class-targeted
announcement — the matching family's guardian sees it, the other
guardian's `GET /guardian-portal/announcements` returns an empty list,
not a 403 or an error. Isolation is the default outcome of the query,
not a special case bolted on.

**Frontend**: staff get a new "Communications" nav section with
`AnnouncementsPage` (create form with a target-type selector that
conditionally reveals class/section pickers, a live feed with
delete). The Guardian Portal gained an "Announcements" nav item and
page: unread items are visually highlighted and badge "New," and
clicking one calls the mark-read endpoint and clears it — real
persisted state, not a client-only dismiss.

## Deliberately not built in this pass

- **SMS/email/WhatsApp/push delivery** — in-app is the one real
  channel, consistent with `models/notifications.py`'s own documented
  platform-wide gap; this ADR doesn't change that.
- **Draft / scheduled publishing** — every announcement is live the
  moment it's created; no approval or future-dated publish workflow.
- **Staff-to-staff messaging or two-way parent-teacher conversation**
  — this is a one-way broadcast from staff to guardians, not a
  messaging system.
- **Attachments** — text only, matching Homework's (ADR-030) same
  named scope limit.

## Verification

6 new backend tests (`test_announcements.py`), all through the real
HTTP API: module-gating (403), a `class`-targeted announcement missing
its class id is rejected (400), a school-wide announcement is visible
to every guardian, a class-targeted announcement is visible only to
that class's guardians (the isolation test, checked from both sides —
the matching guardian sees it, the other guardian's list is empty),
marking read persists across requests and an expired announcement is
correctly hidden, and staff can delete an announcement. Full backend
suite: 273 passed (267 + 6 new), zero regressions. `tsc --noEmit`,
`vite build`, `npm run check:nav-modules` all clean.

Live-verified end to end on a fresh "Comms Test School" tenant, across
both sides of the flow: seeded two separate families in two different
classes with real guardian-portal logins, then as staff published a
real "Grade 1 sports day" announcement targeted at just Grade 1
through the new Communications UI. Logging in as Grade 1's own
guardian showed the notice with its "New" unread badge; logging in
separately as Grade 2's guardian showed a genuinely empty announcements
list — not a 403, an honest empty state, confirming the isolation
holds through the real UI, not just the API. Clicking the notice as
Grade 1's guardian marked it read and the highlight/badge cleared,
confirmed to persist across a fresh page load. (Caught and fixed a bug
in my own CDP test script along the way, not the app: a generic
"click the button with this text" selector matched the shared
`AuthLayout` marketing header's own "Sign in" nav link before the
login form's actual submit button, since both share that exact text
on the same rendered page — fixed by scoping the click to
`button[type=submit]`.)

## Reversibility

Fully additive: two new tables (own migration + downgrade), one new
permission resource (own backfill migration), one new staff nav
section, one new guardian-portal nav item/page. No existing table,
model, endpoint, or route changed.
