# ADR-036: Hostel — the last Phase 6 slice, reusing Employee for wardens

**Context:** the third and last Phase 6 slice, completing Transport
(ADR-034) and Library (ADR-035). Same reuse-first audit as both: does
a hostel warden need a new staff entity, or does this codebase already
have one? It does — `Employee` (`models/hr.py`), the exact same
precedent `Section.class_teacher_id` (ADR-025) and Transport's
`driver_id` (ADR-034) already established. `Hostel.warden_id` reuses
it directly; no parallel staff model was introduced.

## What shipped

**Three new tables** (`models/hostel.py`, migration `32eb3239f3df`):

- `Hostel` — a building (`name`, `hostel_type`: boys/girls/co_ed,
  optional `warden_id`).
- `HostelRoom` — rooms within a hostel, each with a real `capacity`.
- `StudentHostelAllocation` — one row per student per academic year,
  same "history is never silently overwritten" reasoning as
  `StudentEnrolment` (ADR-025) and `StudentTransportAssignment`
  (ADR-034): re-allocating a student within the same year updates that
  year's row in place, verified directly. A **second** real
  constraint beyond that pattern's precedent: `(room_id, bed_number,
  academic_year_id)` is also unique, so two students can never be
  allocated the same bed at once — verified by allocating a bed to one
  student, then rejecting (409) the same bed for a different student.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`052302528c24`) — one resource,
`"hostel"`, covering all three tables.

**Service-level validation genuinely matters here more than in the
other two Phase 6 slices**: `allocate_student` checks `bed_number`
against the room's actual `capacity` before ever touching the unique
constraint, giving a clear `400` ("Bed number must be between 1 and
this room's capacity") instead of a confusing raw constraint
violation, and separately checks bed occupancy for a friendly `409`
naming the conflict rather than a generic database error.

**Frontend**: `HostelPage` — hostel creation with an inline warden
picker (reusing the existing `/employees` list, same as Transport
reused `/vehicles`/`/drivers`), room management per hostel, and a
cascading class → section → student allocation form scoped to a
selected room's real occupancy view. `StudentDetailPage` and
`GuardianPortalChildPage` both gained a real Hostel card (hostel name,
room, bed, warden name+phone) — the same `get_student_hostel` service
call underneath both, the guardian-portal one wrapped in the same
`_owned_student` ownership check every other guardian-portal read
uses.

## Deliberately not built in this pass

- **Mess/meal attendance tracking for boarders** — a real, separate
  feature; not attempted here.
- **Leave/outpass management** — no boarder leave-request workflow.
- **Room change / vacate history** — like Transport, a mid-year change
  today just updates that year's one row in place; no separate
  change-log table.
- **Fee integration (hostel fees)** — unlike tuition fees (ADR-031),
  hostel accommodation isn't wired into the FeeHead/Invoice pipeline
  in this pass.

## Verification

7 new backend tests (`test_hostel.py`), all through the real HTTP
API: module-gating (403), room creation rejects a non-positive
capacity (400), allocating a student correctly shows up on both the
room's occupancy view and the student's own hostel view (hostel name,
room, bed, and the real warden's name all correctly joined), a bed
number beyond the room's capacity is rejected (400), allocating an
already-occupied bed to a *different* student is rejected (409),
re-allocating the same student within the same year updates in place
rather than duplicating, and the Guardian Portal reflects the same
real allocation through the existing ownership check. Full backend
suite run in the background alongside this slice's own build/CDP work
(see below for result). `tsc --noEmit`, `vite build`, `npm run
check:nav-modules` all clean.

Live-verified end to end on a fresh "Hostel Test School" tenant, the
full staff-side flow through the UI with no seed data: created a real
hostel with a real employee assigned as warden (name correctly
resolved and displayed, not just an id), added a room with a real
capacity, and allocated a real student to a specific bed via the
cascading picker — confirmed on screen at each step. Confirmed the
exact same real allocation (hostel name, room, bed, warden name)
appeared identically on the student's own staff-facing profile page
and — after logging in as that student's actual guardian — in the
Guardian Portal, alongside honest empty states for the other
not-yet-populated cards on that same child.

## Reversibility

Fully additive: three new tables (own migration + downgrade), one new
permission resource (own backfill migration), one new nav item, one
new staff page, one new card each on `StudentDetailPage` and
`GuardianPortalChildPage`. No existing table, model, or endpoint was
changed. This closes out Phase 6 (Transport, Library, Hostel) in
full.
