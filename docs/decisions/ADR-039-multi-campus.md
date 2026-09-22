# ADR-039: Multi-campus — reused the existing Branch model as "campus," not a new entity

**Context:** the last Phase 7 item (Analytics/ADR-037 and Integrations/
ADR-038 already shipped; AI Copilot explicitly skipped by request).
Unlike every other slice in this vertical, this one is a retrofit, not
a new isolated domain — it needed branch-scoping added across the
existing education tables, none of which carried `branch_id` before
this ADR. Given the size and risk (the biggest blast radius of
anything built in this vertical), the user was asked to confirm scope
before any code was written; they chose the full retrofit over a
lighter Student-only version.

`models/education.py`'s own docstring, written back in ADR-025,
already named the answer: "a single-school tenant's existing Company
already plays the role of 'the school'... no separate School model was
introduced." Company already represents the school (or trust) as a
whole; the platform's existing `Branch` model — already reused by
Employee, Vehicle, Invoice, and every other core-infra table this
vertical has borrowed from — already represents "one physical
location" for every other industry. A campus is exactly that. No new
`Campus` table was created; `Branch` **is** campus.

## What shipped

**One migration** (`f1c2d3e4b5a6`) adds `branch_id` to six tables —
`SchoolClass`, `Student`, `AdmissionEnquiry`, `AdmissionApplication`,
`Hostel`, `BookCopy` — and `target_branch_id` (nullable) to
`Announcement`. Every existing row is backfilled from its own tenant's
earliest `Branch`, not a single assumed global branch, since
`POST /branches` has always been a generic, ungated endpoint any
tenant could already have called before this migration ran. Verified
directly against the real `greenwood-demo` tenant: all 3 existing
school classes, 9 students, 1 enquiry, 1 hostel, and 2 book copies
backfilled with a real, non-null `branch_id`.

**Which tables got a column, and which didn't, follows one rule that
was already established, not invented for this slice:** `SchoolClass`
and `Student` already stored `company_id` directly (not derived
through a parent FK) — the same "primary entity" pattern now gets
`branch_id` too. `Section`, `StudentEnrolment`, `Homework`,
`ExamSubjectSchedule`, `FeeStructureItem`, and `TimetableEntry` never
duplicated `company_id`; they derive it through a parent FK, and they
derive `branch_id` the same way now — no redundant column added.
`TransportRoute` needed **zero** change: its `vehicle_id` already
points at the core `Vehicle` model, which already carries `branch_id`
from the fleet domain, so campus is one join away without a new
column at all.

**`AcademicYear` stays company-wide, deliberately.** A trust's academic
calendar is the same dates across every campus in the real world; only
the classes, sections, and rosters differ per campus. This was a real
design decision, not an oversight — named explicitly in
`models/education.py`'s updated docstring.

**Two new real, enforced constraints**, not just column additions:
`enrol_student` and `create_student` now reject an enrolment into a
class at a different campus than the student's own `branch_id`;
`issue_book` and `allocate_student` (hostel) reject issuing/allocating
across campuses the same way. Verified live: attempting to enrol a
North Campus student into a Main Branch class on the real
`greenwood-demo` tenant returns a real 400, not a silent cross-campus
mix.

**Analytics (ADR-037) gained an optional `branch_id` filter on all six
endpoints**, narrowing every KPI and chart to one campus. Every query
that needed a new join to reach `branch_id` (attendance, fees, exam
performance, transport, hostel) only adds that join when the filter is
actually set — the unfiltered "all campuses" view is byte-identical to
pre-ADR-039 behavior, not a new default someone has to opt out of.

**Zero new frontend pages.** Campus management is just `POST/GET
/branches`, already fully generic and already routed
(`/branches`, gated on `module: "education"` in nav) before this ADR —
adding a campus is unchanged. What changed: `StudentDrawer`,
`ClassesPage`, `AdmissionEnquiriesPage`/`AdmissionApplicationsPage`/
`AdmissionApplicationDetailPage`, `HostelPage`, `LibraryPage`,
`AnnouncementsPage`, and `AnalyticsPage` each gained a campus picker
in their create forms (and a campus filter where staff need to narrow
a list), following the exact `<select>`-fetches-`/branches` pattern
`EmployeeDrawer`/`EmployeesPage` already established for the same
field.

**Announcements gained a fourth target tier: `campus`** (between
`school` and `class`), resolved live off each linked child's
`Student.branch_id` in `services/announcements.py::_guardian_scope` —
the same "resolved live, never cached" discipline the class/section
targeting already followed.

## Deliberately not built in this pass

- **Per-campus staff/role scoping** — a user with `students.view` can
  still see every campus's students; there's no "confined to Campus X"
  role yet. Named, not faked: the permission system's scoping unit is
  the tenant, not the branch, and changing that is a materially
  different, larger change than this ADR's.
- **Cross-campus student transfer as a tracked event** — moving a
  student's `branch_id` is a plain field update today, not a workflow
  with its own history row (the same scope limit StudentEnrolment's
  own "no separate per-transfer history table yet" already names for
  section transfers).
- **A global campus switcher in the app shell** — every page that
  needs campus scoping got its own filter/picker, matching how every
  other cross-cutting filter in this app already works (branch pickers
  on Employees/Warehouses, the Fees/Transport pages' own existing
  branch fields); no new shell-level context was introduced for this
  one feature.

## Verification

Full backend suite: 301 passed, zero regressions — the real cost of
this retrofit showed up as 62 existing tests across 14 files needing a
`branch_id` added to their fixture's `Student`/`SchoolClass`/
`AdmissionEnquiry`/`AdmissionApplication`/`Hostel`/`BookCopy` creation
calls (now required fields), not as broken behavior; every one was a
mechanical fixture update. 3 new backend tests exercise the real
cross-campus rejection (enrolling into a different-campus class,
issuing a different-campus book copy). `tsc --noEmit`, `npm run
build` (including `tsc -b`'s stricter project-reference check, which
also caught and fixed 5 unrelated pre-existing errors this session's
earlier `tsc --noEmit`-only checks had missed), and `npm run
check:nav-modules` all clean.

Live-verified against the real `greenwood-demo` tenant: created a real
second campus ("North Campus") via the already-existing `POST
/branches`, a real Grade 6 class and a real student ("Zoya Khan")
there. `GET /analytics/overview` returned 10 total students
unfiltered, 9 filtered to Main Branch, 1 filtered to North Campus —
exact numbers, not approximate. Attempting to enrol that North Campus
student into a Main Branch class returned a real
`VALIDATION_ERROR: "This class belongs to a different campus..."`,
not a silent success. In the live browser (CDP-driven headless
Chromium): the Classes & Sections page correctly labeled "Grade 6"
"North Campus" and every other class "Main Branch" under the same
"All campuses" view; the Analytics page's new campus dropdown, when
switched to "North Campus," updated every KPI tile to the real
single-student numbers (1 active student, honest `—` placeholders for
attendance/fees/hostel since that student has no such records yet,
rather than a fabricated 0%) and every chart to "No data yet" —
exactly the honest-metric behavior ADR-037 already established,
now correctly scoped per campus.

## Reversibility

The largest-blast-radius slice in this vertical, but still additive at
the schema level: every new column is nullable-then-backfilled in the
same migration, no existing column was renamed or removed, and no
table was dropped. The two new cross-campus validation checks
(`enrol_student`, `issue_book`, `allocate_student`) are each a few
lines guarded by a real, already-fetched value — reverting them
individually doesn't require touching the schema. The Analytics
`branch_id` filter is opt-in per query parameter; removing it entirely
would just mean dropping six `if branch_id:` blocks, with the
unfiltered path unchanged either way.
