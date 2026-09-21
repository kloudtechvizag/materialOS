# ADR-032: Guardian (Parent) Portal — reusing the customer-portal pattern, not a new auth system

**Context:** the first of Phase 5's two pieces (Communication Center is
the other, not started). Before writing any code, this slice audited
whether MaterialOS already had a working pattern for "an external,
restricted-identity login that isn't staff" — because building a
second, parallel authentication system next to a working one would be
exactly the kind of duplicate implementation this project avoids. The
audit found one: the existing customer portal (ADR-009) already proves
the whole shape — `User.customer_id` (nullable, scopes a login to
exactly one `Customer`), `deps.get_portal_customer` (identity-scoping,
not RBAC), a `create_portal_login` staff-side provisioning function,
and a fully separate frontend shell/login/route-guard
(`PortalShell`/`PortalLoginPage`/`RequirePortalAuth`). This ADR is that
exact pattern, applied to `Guardian` instead of `Customer`.

One thing the audit also found: `Guardian.user_id` (added in ADR-025)
was already sitting there with a docstring calling it "the real
self-service linkage point for the eventual Parent Portal" — but it
had zero real usage anywhere in the codebase. It was never wired up.
Rather than build on an unproven placeholder, this ADR follows the
*proven* mechanism instead (`User.customer_id`'s direction and
`ondelete=CASCADE` semantics, plus an index on the hot auth-path
column) and adds the real, working equivalent: `User.guardian_id`.
`Guardian.user_id` is left untouched — a pre-existing, still-unused
column, not something this ADR needed to touch or repurpose.

## What shipped

**One additive column**: `User.guardian_id` (migration
`8e8b79d6041d`), modeled field-for-field on `User.customer_id`.
**`deps.get_portal_guardian`** mirrors `deps.get_portal_customer`
exactly — every `/guardian-portal/*` endpoint depends on it, never on
`require_permission`, so it scopes to exactly one guardian regardless
of what RBAC permissions the (permission-less) "guardian" system role
happens to carry.

**`services/guardian_portal.py`** — `create_guardian_portal_login`
mirrors `services/portal.py::create_portal_login` line-for-line
(lazy "guardian" system role, `UserRole` join, no RBAC permissions
granted). Every read (`get_child_attendance`, `get_child_homework`,
`get_child_fees`, `get_child_timetable`, `list_child_examinations`,
`get_child_report_card`) calls straight into the exact same service
function the staff-facing UI already uses
(`get_student_attendance_history`, `get_student_homework`,
`get_student_fee_summary`, `get_report_card`, `get_section_timetable`)
— a guardian's view is the same real data staff see, filtered to their
own children, never a parallel read path. Every one of those calls is
preceded by `_owned_student`, which re-checks the `StudentGuardian`
link by id on every request (never assumed from the id alone) — the
same ownership discipline `services/portal.py`'s own module docstring
establishes for the customer portal, since RLS only enforces tenant
isolation, never per-guardian isolation within a tenant.

**Two small denormalizations, both because a guardian-portal account
has zero RBAC permissions and therefore cannot call the generic staff
endpoints to resolve names itself**: `ChildSummaryOut` includes
`school_class_name`/`section_name` directly (not just ids), and the
timetable endpoint returns a dedicated `ChildTimetableEntryOut` with
`subject_name`/`slot_name` resolved server-side — the same reasoning
`TeacherScheduleEntryOut` (ADR-028) already established for a
different actor with the same constraint.

**Staff-side provisioning**: `StudentDetailPage`'s Guardians card
gained a "Grant portal access" action per guardian (email + password),
calling `POST /guardians/{id}/portal-access` — the education-vertical
equivalent of `Customer360Page`'s existing "Create portal access."

**Frontend**: a fully separate portal, not a reduced view of the
internal dashboard — `GuardianPortalShell` (its own chrome, "Parent
Portal" branded), `GuardianPortalLoginPage` (same `/auth/login`
endpoint as staff, rejects the login client-side if `guardian_id` is
absent from `/auth/me`, exactly mirroring `PortalLoginPage`'s own
customer-rejection logic), `GuardianPortalDashboardPage` (lists real
linked children), `GuardianPortalChildPage` (attendance %, homework
status, fee invoices with live outstanding, a day-grouped timetable,
and report cards — all read-only).

## Deliberately not built in this pass

- **Student-direct login** — only Guardian (parent) accounts exist;
  named explicitly rather than half-building a student identity type.
  Real schools commonly route young students' portal access through a
  parent account anyway.
- **Fee payment from the portal** — the Fees card shows real invoices
  and live outstanding balances, but "Record payment" stays a
  staff-only action (ADR-031 already named "parent-facing pay my fees"
  as deferred pending a payment gateway).
- **Report card PDF/print view, push notifications on new homework or
  low attendance** — data is real and live-fetched; no export or
  proactive alerting exists yet.

## Verification

7 new backend tests (`test_guardian_portal.py`), all through the real
HTTP API: module-gating (403), a staff login is rejected from the
guardian portal (403, with the identity-scoping message asserted, not
just the status code), a guardian portal login lists their real linked
child, a guardian sees their child's real attendance and homework
(seeded and marked by staff first), a guardian's timetable view
resolves subject/slot names correctly, a guardian is rejected (404,
not silently empty) when requesting a student who is not their own
child, and a guardian sees their child's real fee invoice with the
correct live outstanding balance. Full backend suite: 267 passed (260
+ 7 new), zero regressions — notably including the entire existing
customer-portal test suite, confirming the new `User.guardian_id`
column and `get_portal_guardian` dependency didn't disturb the proven
`customer_id`/`get_portal_customer` mechanism it was modeled on. `tsc
--noEmit`, `vite build`, `npm run check:nav-modules` all clean.

Live-verified end to end on a fresh "Portal Test School" tenant,
across both sides of the flow: as staff, seeded a real student with
attendance and homework, then used the new "Grant portal access" UI
on the student's own profile page to create a real guardian login
(confirmed the exact success message naming the guardian). Logged out
entirely, then logged in fresh as that guardian at the separate
`/guardian-portal/login` URL, landed on "My children" showing exactly
one real linked child with the correct class/section, drilled into
her profile and confirmed the Attendance and Homework cards showed the
exact same real data just seeded (100% present, "Read Chapter 2"
marked submitted) with honest empty states for Fees/Timetable/Report
cards (nothing fabricated to fill space). Separately confirmed a
staff account attempting to log into `/guardian-portal/login` is
cleanly rejected client-side with the correct message and no
half-authenticated session left behind.

## Reversibility

Fully additive: one new nullable column on an existing table
(`users.guardian_id`, own migration + downgrade, no new permission
resource since guardian-portal accounts intentionally carry none),
one new backend router, one new frontend shell/login/dashboard/child
page, one new staff-side UI addition to `StudentDetailPage`. No
existing table, model, endpoint, route, or the customer portal it was
modeled on was changed.
