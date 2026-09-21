# ADR-030: Homework & Assignments — staff-tracked submissions, no portal yet

**Context:** the second and last of Phase 3's two independent pieces
(Examinations & Report Cards, ADR-029, shipped first). This closes out
Phase 3 entirely.

## What shipped

**Two new tables** (`models/homework.py`, migration `d8e9f0a1b2c3`):

- `Homework` — assigned to a real `section_id` + `subject_id` (the
  same Section/Subject masters ADR-025/ADR-028 already established),
  with `assigned_date`/`due_date` (rejecting `due_date < assigned_date`
  server-side).
- `HomeworkSubmission` — one row per (homework, student):
  `pending | submitted | late | missing`, plus a `submitted_date` set
  automatically when a status transitions to `submitted`/`late`.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`e9f0a1b2c3d4`) — one resource,
`"homework"`, covering both tables.

**The one design choice worth naming: submission status is
staff-marked, not student-submitted.** No student/parent portal exists
yet (Phase 5), so there is no self-service upload or "mark my own
homework done" flow. Rather than leaving submission tracking half-built
or faking a submission button nobody can actually reach, this ships
the same shape ADR-027 (attendance) and ADR-029 (marks entry) already
established: a real roster (`GET /homework/{id}/roster`, resolved from
the section's actual current enrolment) with a bulk upsert endpoint a
teacher uses to mark each student's real submission status by hand —
e.g. while collecting notebooks in class. This is genuine, usable
staff-facing functionality today, not a placeholder for the eventual
portal.

**Frontend**: `HomeworkPage` (list across all sections/years, with a
cascading Academic Year → Class → Section create form matching every
other creation flow in this vertical), `HomeworkDetailPage` (one-tap
status pills per student, mirroring `StudentAttendancePage`'s exact
interaction pattern, bulk-saved in one call). `StudentDetailPage`
gained a "Homework" card listing every homework ever assigned to any
section the student has been enrolled in (resolved from their real
enrolment history, not a "current section" pointer — the same
reasoning `get_student_homework` shares with ADR-025's
`StudentEnrolment` design), each with its own status badge.

## Deliberately not built in this pass

- **Student/parent self-service submission** — no portal exists yet;
  named above as the reason staff-marking is today's real workflow,
  not a stopgap hiding a missing feature.
- **File attachments** — homework is title/description text only; no
  upload/attachment storage.
- **Grading / marks integration with Examinations** — homework
  submission status is tracked independently of the Examinations
  domain; a submitted assignment does not feed into any grade.
- **Due-date reminders / overdue notifications** — depends on the
  not-yet-built Communication Center (Phase 5).

## Verification

5 new backend tests (`test_homework.py`), all through the real HTTP
API: module-gating (403), due-date-before-assigned-date rejected
(400), the roster reflects real enrolment and starts "pending", bulk
submission marking then confirming both the roster and the
per-student `/students/{id}/homework` view agree, and the
upsert-not-duplicate guarantee on re-marking. Full backend suite: 254
passed (249 + 5 new), zero regressions. `tsc --noEmit`, `vite build`,
`npm run check:nav-modules` all clean.

Live-verified end to end on a fresh "Homework Test School" tenant:
created a real homework assignment through the UI (no seed data)
against a real section/subject, opened its roster and confirmed both
enrolled students defaulted to "Pending," one-tap-marked one
"Submitted" and one "Missing," saved, and cross-verified via a direct
API call that the persisted roster matched exactly (including the
auto-set `submitted_date` on the submitted student and `null` on the
missing one). Opened both students' own profile pages independently
and confirmed each one's Homework card showed the correct status
without re-deriving it client-side.

## Reversibility

Fully additive: two new tables (one migration + downgrade), one new
permission resource (own backfill migration), one new nav item, two
new frontend pages, one new card on `StudentDetailPage`. No existing
table, model, endpoint, or route changed.
