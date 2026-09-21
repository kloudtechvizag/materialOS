# ADR-025: School Management — the foundational SIS (industry #26)

**Context:** a 54-section master prompt asked for "MaterialOS
Education" — a complete, modern School Management ERP (admissions,
attendance, timetables, examinations, report cards, fees, transport,
library, hostel, HR/payroll, communication, an AI Copilot, multi-
campus support, and more) as a new business profile. This is a
genuinely new vertical spanning what the prompt's own included
recommendation calls V1 through V4, with even "V1 — Core School ERP"
bundling 7 subsystems. Nothing school-related existed anywhere in the
codebase before this (confirmed by direct grep). Consistent with how
every other large request this project has handled, this was audited
and sliced rather than attempted whole: the user picked **Business
profile + core Student Information System (SIS)** as the first slice
— the dependency root every other subsystem in the spec (admissions
converts into a Student, attendance/fees/exams mark against one,
report cards and the parent portal read from one) needs to exist
before anything else can be built honestly.

## What shipped

**`school_education` registered as a real `IndustryProfile`**
(`services/industry.py`, profile #26 of 26) — same mechanism every
other profile already uses, not a fork or a separate app. New module
key `"education"`, empty `terminology` (no items/inventory concept
exists yet to relabel), empty `dashboard_widgets` (same "left empty
rather than padded with generic ERP widgets it has no use for"
reasoning as Laboratory), and a real `golden_workflow` ("Add student"
→ `/students?new=1`, steps `["Add student", "Assign class & section"]`
— honestly scoped to only what this slice actually built, not the
spec's eventual admissions→exams→report-card pipeline).

**Seven new tables** (`models/education.py`, migration `f8a9b0c1d2e3`):
`AcademicYear`, `SchoolClass`, `Section`, `Guardian`, `Student`,
`StudentGuardian`, `StudentEnrolment`. Standard per-tenant RLS + the
`audit_trg` trigger on all seven, same treatment as every other
human-driven business record in this codebase.

**The one architectural decision worth naming explicitly: enrolment
is its own historical table, not a `current_class` column on
Student.** The spec is explicit — "do not overwrite a student's
previous academic history when promoting." `StudentEnrolment` has one
row per student per academic year (a real unique constraint enforces
this), and promoting a student to next year is a new row, not an
update to an existing one. `Student` itself carries no "current class"
field at all; `services/education.py::get_current_enrolment` resolves
it live by joining to whichever `AcademicYear` is flagged
`is_current`. A within-year section *transfer* does still update that
year's own row in place — full per-transfer history isn't built this
pass, named as a real, deliberate scope limit rather than silently
absent.

**No separate `School` or `Campus` entity.** A single-school tenant's
existing `Company` already plays the role of "the school" (spec's own
section 2: "reuse the existing MaterialOS shared platform... Company
management"). Multi-campus/School Groups (spec section 36) is
explicitly Phase 7 in the spec's own recommendation — when it's built,
it's a real `Campus` layer under `Company`, not a retrofit.

**Two real, necessary permission-catalog migrations, same class of
gap this project has hit and fixed three times before** (a1f4c9e02b7d/
c7e1a49f0b6d/b8c9d0e1f2a3): `RESOURCES` gained `students`, `guardians`,
`academic_years`, `school_classes`; migration `a9b0c1d2e3f4` backfills
those permission codes onto every already-existing tenant's owner
role, since `ensure_permission_catalog()` only inserts at app boot /
signup, never during a migration. Every education endpoint is also
gated by `require_module("education")` at the router level (same
pattern as `laboratory`/`printing`), so a non-school tenant's owner
gets a real 403 by URL alone, not just a hidden nav link.

**Frontend**: a new "Students" nav section (Student Directory, Classes
& Sections, Academic Years, Branches — the last because a single-
school tenant still has exactly one real Branch from signup and needs
somewhere to manage it, same reasoning `inventory-trading`/`projects-
services` already established), promoted to primary position via
`PRIMARY_SECTION_BY_MODULE`. Real pages, not placeholders:
`StudentsPage` (paginated directory), `StudentDrawer` (two-step
admission: personal info, then an *optional* enrolment step — the
spec's own "do not require every module to be configured before the
school can start using the system"), `StudentDetailPage` (profile +
real enrolment history + guardian linking, mirroring the `EmployeeDrawer`/
`EmployeeDetailPage` pattern this session already established for
People & Payroll), `ClassesPage` (classes + nested section management,
scoped to one academic year at a time), `AcademicYearsPage`.

**A real bug found and fixed while verifying the connected lifecycle
live**: the dashboard's Quick Actions panel (ADR-024) unconditionally
offered "Add customer"/"Add item" for every profile — correct for the
25 trade-style profiles, but School Management has no Customers/Items
nav entry at all (Guardians replace the "customer" concept; no
inventory module exists yet), so those two actions would have pointed
at pages with no way back. Fixed by excluding them specifically when
`enabled_modules` includes `"education"`, rather than fabricating nav
entries for concepts a school doesn't have yet just to keep the
Quick Actions panel uniform.

## Deliberately not built in this pass

Named explicitly, matching the spec's own phased recommendation — none
of this is silently missing:

- **Admissions CRM** (enquiry → application → decision → enrolment) —
  Phase 2. A student can be admitted directly today (the realistic
  MVP path for a school already operating), but the funnel/pipeline/
  online-application-portal layer on top is separate, real work.
- **Attendance, timetables, examinations, report cards, homework** —
  Phases 2-3. All need a real Student to mark against, which is
  exactly what this slice built.
- **Fees, accounting integration** — Phase 4.
- **Parent/student portals, communication center** — Phase 5.
  `Guardian.user_id` is a real, nullable FK laid down now (same "link
  it when self-service actually activates" pattern as `Employee.
  user_id`), but nothing links or exposes it yet.
- **Transport, library, inventory/assets, hostel, HR/payroll
  integration beyond reusing the existing Employee model for class
  teachers** — Phase 6.
- **Multi-campus, AI Copilot, advanced analytics, external
  integrations, offline workflows** — Phase 7.
- **A real academic-year rollover workflow** — `AcademicYear.
  is_current` exists and `create_academic_year` flips exactly one year
  current per company, but there's no guided promotion/rollover UI
  (spec section 37) yet — a student is enrolled in a new year via the
  same generic enrolment endpoint, not a bulk promotion tool.

## Verification

7 new backend tests (`test_education.py`), all exercised through the
real HTTP API, not the service layer directly: module-gating (a non-
school tenant gets a real 403), academic year/class/section setup,
`is_current` correctly flips off the previous year when a new one is
marked current, admission numbers are server-generated and sequential
(`STU-0001`, `STU-0002`, ...), a student can be created *without* an
immediate enrolment (real, valid state), duplicate enrolment for the
same academic year is rejected (409), and the full connected lifecycle
— admission → enrolment → guardian linking, including a real duplicate-
link rejection. Full backend suite: 226 passed (219 + 7 new), zero
regressions. `tsc --noEmit`, `vite build`, and `npm run check:nav-
modules` all clean.

Live-verified end to end against the running `docker-compose` stack
via headless Chromium on a freshly signed-up "Greenwood International
School" tenant: created a real academic year, class, and section;
admitted a student ("Ishaan Verma") through the real two-step drawer
UI, watched the enrolment step correctly cascade Academic year → Class
→ Section as real dependent selects; confirmed the student appeared
immediately in the directory with a server-generated admission number
(`STU-0001`) and correct status badge; opened the student's profile
and confirmed the real enrolment history row ("2026-27, Grade 5 - A,
Roll 12"); added and linked a guardian ("Mrs. Verma") through the
profile's own inline form and confirmed it rendered correctly marked
Primary. Confirmed the sidebar promotes "Students" to the top position
under Approvals, confirmed the dashboard adapts correctly (School
Management badge, empty KPI grid — honest, no widgets built yet — Quick
Actions correctly limited to "Add student" only, Recent Activity
correctly showing the real admission/enrolment/guardian audit events).

## Reversibility

Fully additive: seven new tables (own migration, own downgrade), one
new `IndustryProfile` row, four new permission resources (own backfill
migration), one new nav section, five new frontend pages/components,
one new backend router. No existing table, endpoint, or route
signature changed except the two-line Quick Actions carve-out in
`DashboardPage.tsx`. Removing the vertical means reverting the nav
section, deleting the new frontend files, dropping the seven tables,
and removing the `school_education` profile definition — nothing else
in the platform depends on any of it existing.
