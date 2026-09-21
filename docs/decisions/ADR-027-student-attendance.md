# ADR-027: Student Attendance — one-tap class marking

**Context:** the third slice of MaterialOS Education, continuing Phase
2. Of the two remaining independent pieces from the earlier fork
(Attendance, Timetable), Attendance was picked as the more directly
dependent on what already existed — it needs only a real Student and
Section (both real since ADR-025), while a real Timetable would be a
genuinely new, more novel data model with no existing MaterialOS
analog. Spec sec11's own list (daily attendance, period-wise
attendance, late/early/excused/half-day, corrections, one-tap class
marking, bulk marking) was scoped down to daily-granularity, class-
level marking — period-wise attendance needs a real Timetable to mark
against, which doesn't exist yet; naming that dependency rather than
faking a period selector with nothing real behind it.

## What shipped

**One new table** (`models/student_attendance.py`, migration
`d2e3f4a5b6c7`): `StudentAttendanceRecord`, one row per student per
calendar day (`UniqueConstraint(tenant_id, student_id, attendance_date)`,
mirroring the existing employee `AttendanceRecord`'s own shape —
spec sec12's explicit "keep student attendance and employee attendance
as separate domain workflows" is honored by using a wholly separate
table and resource, not a shared one with a discriminator column).
Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table added this vertical (`student_attendance` is now the
fifth resource this project has had to backfill onto existing owner
roles — `e3f4a5b6c7d8`).

**The one design choice worth naming: class/section are snapshotted
onto each attendance record at mark time, not resolved live from
"current" enrolment.** A student who transfers sections in November
should still show correctly in *October's* attendance roster as
belonging to their October section, even after the transfer — this
mirrors ADR-025's own `StudentEnrolment` reasoning (history is never
silently rewritten by later state), applied one level down.

**A real bulk-mark endpoint with upsert semantics**
(`POST /student-attendance/bulk`): re-marking the same student on the
same date updates the existing row in place rather than erroring or
duplicating — verified directly (`test_re_marking_the_same_date_
updates_in_place_not_duplicates`). A dedicated correction-*approval*
workflow (spec's own "Attendance corrections, Correction approvals")
was not built — today any user with `student_attendance.create` can
simply re-mark a day directly, which is real and works, but isn't the
separate reviewable-correction-request flow the spec describes.

**Frontend**: `StudentAttendancePage` — real cascading Academic Year →
Class → Section selects (the same three-level resolution `StudentDrawer`
already established for enrolment) plus a date picker, loading a real
roster from `GET /student-attendance/roster` (every currently-enrolled
student in that section, already-marked status if any). Every student
defaults to "present" client-side only — nothing is written until
"Save attendance" is pressed, so loading the page never silently
records attendance nobody actually took. One-tap status pills
(Present/Absent/Late/Half day/Excused/On leave) satisfy the spec's own
"one-tap class attendance" language directly — a single click sets a
student's status, a single "Save attendance" persists the whole
roster in one bulk call. `StudentDetailPage` (ADR-025) gained a real
Attendance card: a computed present-percentage and a compact dot
timeline of the most recent 20 recorded days — genuine derived data,
not a placeholder.

## Deliberately not built in this pass

- **Period-wise attendance** — needs a real Timetable (periods, subject
  allocation) to mark against; named as the natural next dependency,
  not faked with an empty period selector.
- **Attendance correction *requests* with approval** — today a re-mark
  is a direct, unaudited-beyond-the-trigger overwrite (the `audit_trg`
  on this table does capture every change, so the *record* of what
  changed and when is real — there's just no request/approve workflow
  layered on top yet).
- **Parent notifications on absence** — depends on the not-yet-built
  Communication Center (Phase 5) and a real parent-portal identity for
  `Guardian.user_id` to notify.
- **RFID/biometric device integration** — explicitly optional per the
  spec's own language; `method` isn't even modeled yet since there's
  only one real input path (manual, web) today.
- **Missing-attendance alerts, absence-pattern analytics, class-wide
  attendance trend reporting** — real reporting work over data that
  only exists as of this ADR.

## Verification

4 new backend tests (`test_student_attendance.py`), all through the
real HTTP API: module-gating (403), the roster correctly reflects real
enrolment and starts fully unmarked, bulk-marking three students with
three different statuses and confirming both the roster and the
per-student history endpoint agree, and the upsert-not-duplicate
guarantee. Full backend suite: 236 passed (232 + 4 new), zero
regressions. `tsc --noEmit`, `vite build`, `npm run check:nav-modules`
all clean.

Live-verified end to end on a fresh "Sunrise Public School" tenant:
seeded a real class/section with three enrolled students, opened
Student Attendance and confirmed the roster loaded with every student
defaulted to Present, one-tap-marked one student Absent and one Late,
saved, and confirmed via direct API call that the roster now returned
exactly those three statuses. Opened the absent student's own profile
page and confirmed the new Attendance card correctly computed "0%
present over 1 recorded day" with a red marker in the timeline —
genuinely derived from the record just saved, not a static mock.

## Reversibility

Fully additive: one new table (own migration + downgrade), one new
permission resource (own backfill migration), one new nav item, one
new frontend page, one new card on an existing page
(`StudentDetailPage`). No existing table, model, endpoint, or route
changed.
