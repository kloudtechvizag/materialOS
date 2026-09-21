# ADR-028: Timetable & Scheduling — weekly period grid with teacher-clash detection

**Context:** the fourth slice of MaterialOS Education, completing
Phase 2's fork (Admissions, Attendance, Timetable — all three now
shipped). Attendance's own ADR-027 named period-wise attendance as
blocked on "a real Timetable, which doesn't exist yet"; this ADR is
that dependency landing, and the natural next step (period-wise
attendance) is now unblocked, though not built in this pass.

## What shipped

**Three new tables** (`models/timetable.py`, migration `f4a5b6c7d8e9`):

- `Subject` — a real master (name, code), company-scoped, not a free
  text field on the entry itself; spec sec10's own "Subject master."
- `TimetableSlot` — the school's *shared* daily period grid (Period 1,
  Recess, Period 2, ...), one set of `(sequence, start_time, end_time,
  is_break)` rows per company, not duplicated per class. A real
  school's bell schedule is shared across every class; modeling it
  per-section would let two sections silently disagree about when
  "Period 3" happens.
- `TimetableEntry` — one `(section, day_of_week, slot)` cell:
  `subject_id`, an optional `teacher_id` (reuses the existing HR
  `Employee`, same reasoning as `Section.class_teacher_id` — a subject
  teacher IS an employee, not a parallel Teacher entity), and a
  free-text `room` (no Room master exists yet, named below).
  `UniqueConstraint(tenant_id, section_id, day_of_week, slot_id)`
  makes a section double-booked for one period structurally
  impossible.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`a5b6c7d8e9f0`) — one resource,
`"timetable"`, covering all three tables together (the same coarse
grouping `"school_classes"` already uses for `SchoolClass`+`Section`).

**The one design choice worth naming: teacher double-booking is a real,
enforced conflict check, not a soft warning.** `services/timetable.py`'s
`upsert_timetable_entry` looks for any other `TimetableEntry` at the
same `(day_of_week, slot_id, teacher_id)` before writing and rejects
the write with `409 CONFLICT` naming the clashing section, rather than
silently allowing one teacher to be scheduled in two classrooms at
once. This can't be a single-table unique constraint (`teacher_id`
isn't part of `TimetableEntry`'s own natural key — a slot without a
teacher assigned yet is valid), so it's service-level logic, verified
directly (`test_same_teacher_double_booked_same_slot_different_
section_is_rejected`) including that the rejected write leaves no
partial row behind.

**Frontend** (`TimetablePage.tsx`): the same cascading Academic Year →
Class → Section selects established by `StudentAttendancePage`, then a
real Day × Period grid built from the section's actual entries — not a
static mock grid with empty cells. A collapsible "Manage subjects &
periods" panel lets a fresh tenant create real subjects and periods
in-page (spec's own "do not require every module to be configured
before the system can be used" — nothing here is pre-seeded). Clicking
an empty cell opens an inline editor (subject + teacher + room);
saving a cell that clashes with another section's teacher shows the
real server error inline, in place, rather than failing silently.

## Deliberately not built in this pass

- **Period-wise student attendance** — ADR-027's named dependency is
  now real; wiring attendance-marking to a specific period (not just a
  day) is its own follow-up slice, not bundled into this one.
- **Substitute teacher assignment** — needs a real staff-leave trigger
  (an employee on approved leave for a date should surface a
  substitution prompt for their periods that day); no such linkage
  exists yet.
- **Room/resource master with clash checking** — `room` is free text,
  not a `Room` entity, so a room can technically be double-booked
  today (a teacher cannot). Named, not faked with an unenforced Room
  picker.
- **Published/draft timetable versioning** — every save is live
  immediately; no draft-then-publish workflow.
- **Student/parent-facing "my timetable" view and notifications** —
  the Parent/Student Portal and Communication Center (Phase 5) don't
  exist yet; today's grid is staff-facing only, reached via
  `timetable.view`.

## Verification

7 new backend tests (`test_timetable.py`), all through the real HTTP
API: module-gating (403), setting a cell then reading it back on the
section grid, re-setting the same cell updates in place, the teacher
conflict rejection (409, and confirming the losing write left no row),
break slots reject a subject assignment (400), deleting a cell clears
it, and the teacher-schedule endpoint returns correctly-joined
class/section/subject names. Full backend suite: 243 passed (236 + 7
new), zero regressions. `tsc --noEmit`, `vite build`, `npm run
check:nav-modules` all clean.

Live-verified end to end on a fresh "TT School" tenant: seeded a real
class with two sections and one teacher, opened Timetable, used the
in-page setup panel to create a real subject and period (no seed
data), filled and saved a cell, cross-verified via direct API call
that the persisted grid matched exactly. Then, on the second section
at the same day/period, attempted to assign the *same* teacher and
confirmed the UI surfaced the real "Anita Rao is already scheduled for
this period in section A" error inline — and confirmed via API that
Section B's grid stayed empty (no partial write). Confirmed the
teacher-schedule endpoint independently returns that one real entry
with correctly joined class/section/subject names.

## Reversibility

Fully additive: three new tables (one migration + downgrade), one new
permission resource (own backfill migration), one new nav item, one
new frontend page. No existing table, model, endpoint, or route
changed.
