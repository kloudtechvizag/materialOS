# ADR-026: Admissions CRM — Enquiry → Application → real Student

**Context:** the second slice of MaterialOS Education (ADR-025 built
the foundational SIS: Student, Guardian, AcademicYear, SchoolClass,
Section, StudentEnrolment). Per the master prompt's own phased
recommendation and the user's explicit pick among Phase 2's three
independent pieces (Admissions, Attendance, Timetable), this builds
the admissions funnel (spec sec7): Enquiry → Application → Decision →
Enrolment — the literal next step in the "connected student lifecycle"
this vertical is built around, and the one piece that converts
directly into the exact Student/Enrolment machinery ADR-025 already
built and tested, rather than a stub.

## What shipped

**Two new tables** (`models/admissions.py`, migration `b0c1d2e3f4a5`):
`AdmissionEnquiry` (the low-friction first contact — student name,
desired grade as free text, guardian contact, source, a
`follow_up_date`) and `AdmissionApplication` (the formal pipeline —
linked optionally to an enquiry, a real `academic_year_id` FK since by
decision time the target year should genuinely exist, a `status` state
machine, `interview_date`, `decision_reason`, and `student_id` — null
until conversion). Same RLS + `audit_trg` treatment as every table in
this codebase; same permission-backfill migration pattern (`RESOURCES`
gained `"admissions"`, backfilled onto every existing tenant's owner
role in `c1d2e3f4a5b6` — the fourth time this project has hit and
fixed this exact class of gap). Every endpoint gated by
`require_module("education")`, same as the rest of the vertical.

**The one architectural decision worth naming: `"admitted"` is
unreachable through the generic status-update endpoint.** `PATCH
/admission-applications/{id}` accepts `under_review`,
`interview_scheduled`, `interviewed`, `offered`, `waitlisted`,
`rejected`, `withdrawn` — never `admitted`. The only way an application
reaches `admitted` is `POST /admission-applications/{id}/convert`,
which creates a real `Student` (calling `services.education.
create_student`/`enrol_student` directly — the exact same functions
`StudentDrawer`'s direct-admission flow already uses, not a parallel
implementation) and sets `status`/`student_id`/`decided_at` atomically
in the same transaction. This makes "an application says admitted but
has no student_id" structurally impossible rather than merely
discouraged. `rejected`/`withdrawn` (and `admitted`, transitively) are
terminal — the service layer refuses any further transition once
reached, verified directly (a rejected application returns a real 400
on a subsequent status change, not a silent no-op).

**Desired grade stays free text on both Enquiry and Application,
deliberately never a `SchoolClass` FK until conversion.** An enquiry
routinely predates the target academic year's classes existing at all;
forcing an early FK would create a chicken-and-egg problem the real
world doesn't have. The actual `school_class_id`/`section_id` are only
ever chosen at the real moment they matter — conversion time — via the
same cascading Academic Year → Class → Section selects `StudentDrawer`
already established, not resolved from the free-text label.

**Frontend**: a new "Admissions" nav section (Enquiries, Applications)
sitting directly above "Students," not competing for the primary-
section slot (`students` still wins it, per ADR-025 — Admissions is
real but upstream of the vertical's actual center of gravity).
`AdmissionEnquiriesPage` (table + inline create + a one-click "Convert
to application" quick action that pre-fills from the enquiry and
navigates straight to the new application). `AdmissionApplicationsPage`
(table with status-filter tabs, mirroring `ApprovalsPage`'s own
established tab pattern). `AdmissionApplicationDetailPage` — the real
pipeline UI: a "Move stage" panel with one button per valid transition
(disabled/hidden entirely once terminal, matching the backend's own
refusal rather than just hoping the buttons aren't clicked) and a
"Convert to student" panel that only renders while non-terminal.

**A real bug found and fixed while verifying live** (same discipline
as ADR-024's Quick Actions fix): nothing new this pass, but the
existing `enabledModules.includes("education")` carve-out in
`DashboardPage.tsx`'s Quick Actions (ADR-025) was re-confirmed still
correct — Recent Activity correctly picked up every real admissions
audit event (enquiry created, application created, three status
transitions, the conversion itself) with zero new work, since it
already reads generically off `audit_trg`.

## Deliberately not built in this pass

- **A public-facing enquiry/application web form** — everything here
  is staff-entered (the realistic path for a school already
  operating); a parent-facing intake form is real, separate, Phase-5-
  adjacent work (needs the not-yet-built portal/auth story).
- **Document upload** — no storage wiring attempted; `app.storage`
  exists and is reused elsewhere (item images), so this is a real,
  scoped follow-up, not a gap in the platform.
- **Interview *scheduling*** — `interview_date` is a real field; a
  calendar/availability/conflict system is not attempted.
- **Seat capacity / waitlist ranking automation** — `SchoolClass` has
  no capacity field yet (`Section.capacity` exists from ADR-025);
  `waitlisted` is a real, honest manual status, not an automated
  overflow queue.
- **Admission-fee collection as a pipeline stage** — depends on the
  not-yet-built Fee Management module (Phase 4); the spec's own
  Enquiry→...→Fee Payment→Admission Confirmation chain is real, but
  faking the fee step with no real ledger behind it would be exactly
  the kind of thing this project's own rules forbid.
- **Conversion analytics** (funnel drop-off, source performance) —
  real reporting work over data that only exists as of this ADR; no
  history to analyze yet on a fresh install.

## Verification

6 new backend tests (`test_admissions.py`), all through the real HTTP
API: module-gating (403 for a non-school tenant), enquiry→application
conversion correctly flips the enquiry to `converted`, the full status
transition chain plus the terminal-lock refusal, `"admitted"` proven
unreachable via plain PATCH, and — the critical one — converting an
application creates a real `Student` with a real `StudentEnrolment`
row matching the chosen class/section/roll, with the application
correctly carrying `student_id` back, and a second conversion attempt
correctly refused. Full backend suite: 232 passed (226 + 6 new), zero
regressions. `tsc --noEmit`, `vite build`, `npm run check:nav-modules`
all clean.

Live-verified end to end against the running stack via headless
Chromium on a fresh "Bright Future Academy" tenant: logged a real
enquiry ("Tara Reddy"), converted it to an application with one click,
walked the application through to "Offered" via the real Move Stage
buttons, then converted it to a student by picking a real Class/Section
— landed on `/students/{id}` and confirmed a genuine, enrolled student
record ("STU-0001", "2026-27, Grade 2 - B, active") existed, not a
stub. Cross-checked the application's own final state directly via the
API: `status: "admitted"`, `student_id` populated, `decided_at` set —
every field consistent with what the UI showed.

## Reversibility

Fully additive: two new tables (own migration + downgrade), one new
permission resource (own backfill migration), one new nav section,
three new frontend pages. No existing table, model, endpoint, or
route changed. `convert_application_to_student` calls existing
`services.education` functions but adds no parameters or behavior to
them — removing Admissions entirely means dropping the two tables and
the nav section; the SIS underneath (ADR-025) is completely unaffected
either way.
