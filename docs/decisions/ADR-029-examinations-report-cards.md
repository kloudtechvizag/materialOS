# ADR-029: Examinations & Report Cards — marks entry with a real computed report card

**Context:** the first of Phase 3's two independent pieces (Homework &
Assignments is the other, not started). Built on the real `Subject`
master from Timetable (ADR-028) and the real `Student`/
`StudentEnrolment` foundations from ADR-025.

## What shipped

**Three new tables** (`models/examinations.py`, migration `b6c7d8e9f0a1`):

- `Examination` — a named exam term for an academic year ("Mid Term
  1"), with `is_locked` gating further marks entry once a term is
  finalized (same `PERIOD_LOCKED` error code and reasoning as
  `FinancialYear` locking in `services/numbering.py` — a report card
  should not silently drift after it's been handed out). Unlock is a
  real, permission-gated (`examinations.lock`) action, not one-way.
- `ExamSubjectSchedule` — which subjects a given class is examined on
  for this term, each with its own `max_marks`/`pass_marks` (a class's
  Hindi paper and Math paper legitimately differ).
- `ExamMark` — one row per (schedule, student): `marks_obtained`
  (nullable) and `is_absent`. An absence is `marks_obtained = NULL`,
  not a fabricated zero — a real absence and a genuine zero score
  must not collapse into the same value, since one should read as
  "did not sit the exam" and the other as "sat it and scored zero."

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`c7d8e9f0a1b2`) — one resource,
`"examinations"`, covering all three tables.

**Marks entry** mirrors `StudentAttendancePage`'s roster pattern
exactly: `GET .../roster?section_id=` returns every currently-enrolled
student with whatever mark already exists, and a bulk upsert endpoint
saves the whole section's marks in one call. A marks value is rejected
server-side if it exceeds the schedule's own `max_marks` (`400`), and
the whole endpoint is rejected (`409 PERIOD_LOCKED`) if the
examination has been locked.

**Report cards are computed, not stored.** `GET /examinations/{id}/
report-card/{student_id}` joins the student's real enrolment for that
exam's academic year to every `ExamSubjectSchedule` scheduled for
their class, resolves each subject's `ExamMark` if one exists, and
computes per-subject and overall grade/pass-fail from real data on
every request — the same "genuine derived data, not a placeholder"
approach `StudentDetailPage`'s Attendance card (ADR-027) already
established. A report card with any subject not yet marked reports
`overall_result: "incomplete"` rather than a misleading partial
pass/fail. Grade bands (A+/A/B/C/D by percentage) are a real, working
default applied uniformly — not a per-school configurable scale in
this pass (named below).

**A real bug found and fixed during live verification, not left in
tests alone:** Python's `Decimal` carries the divisor's exponent
through an exact-zero division (`Decimal(0) / Decimal("100.00")` is
`Decimal("0E+2")`, not `Decimal("0")`), which serialized over the wire
as the literal string `"0E+2"` for an absent student's percentage
instead of `"0.00"`. Caught by actually opening the absent student's
report card in the browser (not just asserting a numeric equality in
a test, which Python's own `Decimal("0E+2") == Decimal("0")` would
have passed silently). Fixed with an explicit `.quantize(Decimal
("0.01"))` in a shared `_percentage()` helper, with a regression test
asserting the exact wire string `"0.00"`.

**Frontend**: `ExaminationsPage` (list + create), `ExaminationDetailPage`
(lock/unlock, add class-subject schedules inline, click a schedule to
open its section-scoped marks-entry roster — inputs disable when the
exam is locked or a row is marked absent). `StudentDetailPage` gained
a "Report cards" card: a row of exam chips, click one to lazily fetch
and render that exam's real computed report card (subject table,
overall pass/fail/grade badge).

## Deliberately not built in this pass

- **Configurable grading scale** — grade bands are a fixed default,
  not a per-school/per-exam configuration.
- **Class rank / merit list** — no comparative ranking across a
  section's students is computed.
- **Co-scholastic / skill-based assessment areas** — marks-only; no
  non-numeric rubric assessment.
- **Report card PDF export / print layout** — the computed data is
  real and complete; a formatted printable document is a separate,
  later piece.
- **Parent/student-facing report card view** — same Phase 5 portal
  dependency named in every prior education ADR.

## Verification

6 new backend tests (`test_examinations.py`), all through the real
HTTP API: module-gating (403), the roster reflects real enrolment and
starts unmarked, bulk marks entry then confirming both the roster and
three students' report cards agree (pass/fail/absent), a report card
staying "incomplete" until every scheduled subject is marked, marks
exceeding max_marks rejected (400), and the full lock → blocked write
→ unlock → allowed write cycle (409 `PERIOD_LOCKED`). A regression
test locks in the Decimal percentage fix. Full backend suite: 249
passed (243 + 6 new), zero regressions. `tsc --noEmit`, `vite build`,
`npm run check:nav-modules` all clean.

Live-verified end to end on a fresh "Exam Test School" tenant: created
a real examination and class-subject schedule through the UI (no seed
data), entered marks for three students (one pass, one fail, one
absent) through the roster, confirmed the "Saved." state, then opened
each of the three students' own profile pages and confirmed their
Report Cards card independently computed the correct pass/fail/grade
— including catching and fixing the `0E+2%` bug on the absent
student's card before calling this done. Cross-verified the first
student's report card via a direct API call matching the UI exactly.

## Reversibility

Fully additive: three new tables (one migration + downgrade), one new
permission resource (own backfill migration), one new nav item, two
new frontend pages, one new card on `StudentDetailPage`. No existing
table, model, endpoint, or route changed.
