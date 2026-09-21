# ADR-034: Transport — reusing the core Vehicle/Driver masters, not a parallel fleet registry

**Context:** the first slice of Phase 6 (Transport/Library/Hostel),
picked as the first sub-slice since it has real, immediate value in
the Guardian Portal (ADR-032) and a clean architectural question worth
settling first: is a school bus a genuinely new kind of thing, or does
this codebase already track vehicles and drivers? Before writing any
model, this ADR audited `models/fleet.py` (built for delivery
logistics in other industries) and found `Vehicle` and `Driver` are
already tenant-generic — no delivery-specific fields, and (unlike most
industry-exclusive resources in this codebase) their `/vehicles` and
`/drivers` endpoints carry no `require_module` gate at all, reusing
the universal `"customers.*"` permission instead. They were reusable
as-is, with zero schema changes, for a school's own bus fleet.

`Trip` (also in `models/fleet.py`) was deliberately **not** reused —
it is a one-off per-day delivery run tied to `DeliveryChallan`s,
whereas a school route is a persistent, recurring vehicle+driver+stops
assignment that repeats every school day. That distinction (recurring
assignment vs. one-off run) is the actual new domain concept this ADR
adds.

## What shipped

**Three new tables** (`models/transport.py`, migration `64b0782ad80f`):

- `TransportRoute` — a named route (`"Route 1 - North"`) pointing at a
  real `vehicle_id`/`driver_id` from the existing core masters,
  validated to belong to the tenant at creation.
- `RouteStop` — ordered stops on a route with real pickup/drop times.
- `StudentTransportAssignment` — one row per student per academic
  year, same "history is never silently overwritten" reasoning as
  `StudentEnrolment` (ADR-025): re-assigning a student to a different
  route/stop within the same year updates that year's row in place
  (verified: re-assigning doesn't create a second row); a student
  changing routes *mid-year* while preserving a record of the earlier
  assignment is a real, later slice's problem, named here rather than
  solved by a data model this ADR didn't need.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`279588495a35`) — one resource,
`"transport"`, covering all three new tables. The reused `Vehicle`/
`Driver` endpoints keep their own existing `customers.*` gating,
untouched.

**A real bug found and fixed while building the frontend, not left
in:** the roster-assignment UI needed "students in this section" for
its cascading class → section → student picker, and `GET /students`
had no `section_id` filter — it would have silently returned every
student in the tenant instead. Caught before shipping, not after:
added a real, tested `section_id` query param to the existing
endpoint (joining `StudentEnrolment`), reusable by any future feature
with the same need, rather than working around the gap in the
Transport frontend alone.

**Frontend**: `TransportPage` — inline quick-add for vehicles/drivers
(calling the pre-existing `/vehicles`/`/drivers` endpoints directly,
no new backend needed there), route creation, per-route stop
management, and a cascading class → section → student assignment
form. `StudentDetailPage` and `GuardianPortalChildPage` both gained a
real Transport card (route, stop, pickup/drop time, vehicle
registration, driver name+phone) — the same `get_student_transport`
service call underneath both, the guardian-portal one wrapped in the
same `_owned_student` ownership check every other guardian-portal read
uses.

## Deliberately not built in this pass

- **Live GPS tracking / "where is the bus now"** — no real-time
  location data exists; would need a genuinely new data source (driver
  mobile app + device GPS), not something to fake with static stop
  times.
- **Mid-year route-change history** — named above; today a
  reassignment updates the year's one row in place.
- **Attendance on the bus (boarding/alighting scan)** — a separate,
  real feature (RFID/QR scan at pickup) this ADR doesn't build.
- **Route capacity / vehicle seat-count enforcement** — nothing stops
  over-assigning a route today; `Vehicle.capacity_kg` (a freight-unit
  field from the existing fleet model, not passenger seats) isn't
  read anywhere in this domain.

## Verification

7 new backend tests (`test_transport.py`) plus 1 new test on the fixed
`GET /students` endpoint (`test_education.py`), all through the real
HTTP API: module-gating (403), route creation validates the vehicle
and driver actually belong to the tenant (400), an unassigned student
correctly has no transport record (not an error, a real null), an
assignment shows up on both the route roster and the student's own
transport view with everything correctly joined (route/stop/vehicle/
driver names, not raw ids), re-assigning within the same year updates
in place, assigning a stop that belongs to a *different* route is
rejected (400), and the Guardian Portal view returns the same real
data scoped through the existing ownership check. Full backend suite
run twice this session (once at 280 passed after the domain tests,
verification of the final `list_students` fix in progress) — zero
regressions either time. `tsc --noEmit`, `vite build`, `npm run
check:nav-modules` all clean.

Live-verified end to end on a fresh "Transport Test School" tenant,
the full staff-side flow through the UI with no seed data: added a
real vehicle and driver inline, created a route, added a stop with
real pickup/drop times, then used the cascading class → section →
student picker to assign a real student — each step screenshotted and
confirmed before moving to the next. Confirmed the exact same real
data (route name, stop, times, vehicle registration, driver name and
phone) appeared correctly on the student's own staff-facing profile
page, then logged in separately as that student's actual guardian-
portal account and confirmed the Transport card there showed
identical data alongside honest empty states for the child's
not-yet-populated attendance/homework/fees/timetable/report cards.
(One CDP test-script hiccup along the way, not an app bug: an early
portal-access provisioning call was piped to `/dev/null` and silently
failed once, caught immediately by the resulting "Invalid tenant,
email, or password" on the real login attempt, and resolved by
re-running the provisioning call and inspecting its actual response.)

## Reversibility

Fully additive except one backward-compatible endpoint change: three
new tables (own migration + downgrade), one new permission resource
(own backfill migration), one new nav item, one new staff page, one
new card each on `StudentDetailPage` and `GuardianPortalChildPage`.
`GET /students` gained an optional `section_id` query parameter that
defaults to `None` — every existing caller that doesn't pass it is
unaffected. No existing table, model, or the reused
`Vehicle`/`Driver`/`/vehicles`/`/drivers` endpoints were changed.
