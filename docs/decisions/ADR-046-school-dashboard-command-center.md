# ADR-046: the School Dashboard becomes a real Command Center, not a branch of the generic trade dashboard

**Context:** a 17-section master prompt asked for a full transformation
of the School Management dashboard from a near-empty shell (a
greeting, a generic Needs Attention panel with nothing school-aware
behind it, a raw "Recent activity — 68 events" list, and a single
"+ Add student" button) into a "School Command Center" -- a KPI
overview, a real Needs Attention feed, operational snapshots
(attendance, admissions, fees, today's schedule, academics), role-
aware personalization, AI-generated insights, and dashboard
customization, phased across three passes. Consistent with every
large spec this vertical has received, this was audited and scoped
before any code was written -- the audit found `school_education`'s
`dashboard_widgets` was literally `[]` (deliberately left empty by an
earlier phase, "a real School Command Center is later phase"), and
confirmed the generic `DashboardPage.tsx`/`/dashboard/summary` was
built for a flat KPI-tile registry shared across every industry
profile, not a shape that could honestly hold needs-attention items,
today's schedule, or an admissions pipeline. The user confirmed the
split explicitly: build Phase 1 + Phase 2 (the full real-data command
center) now; gate personalization by the real, already-enforced
per-resource permissions rather than inventing new RBAC role personas;
defer AI-generated insights, consistent with the standing "skip AI
Copilot for now" decision already made for Student 360 (ADR-044).

## What shipped

**A dedicated page tree, not a branch of the generic dashboard.**
`DashboardPage.tsx` gets exactly one new early return -- when the
active profile's `enabled_modules` includes `"education"`, it renders
the new `SchoolDashboardPage` instead of the generic body, before any
of that body's own hooks run. Every other industry profile's
rendering path is byte-for-byte unchanged; live-verified against a
freshly signed-up `building_materials` tenant to confirm the original
KPI tiles, sales trend, receivables chart, and WorkQueue still render
exactly as before.

**One new backend endpoint, not a bolt-on to `/dashboard/summary`.**
`GET /school-dashboard/summary` (`services/school_dashboard.py`,
ADR-046) computes KPIs, Needs Attention, Today's Schedule, an
Academic snapshot, a Staff snapshot, and reuses ADR-045's own
`get_admissions_summary` verbatim for the Admissions snapshot -- "do
not duplicate admission business logic" taken literally. Every number
is computed on read from tables the vertical already writes (the same
discipline as Analytics, ADR-037): active students, new enquiries,
pending admissions, students absent today, fee collection/outstanding/
overdue, staff present today, classes scheduled today, exams
upcoming, marks entry pending, homework overdue-and-unmarked, staff on
leave, and leave requests awaiting approval.

**Personalization is real backend permission gating, not a fake
client-side role concept.** No principal/teacher/admission-counsellor/
transport-manager RBAC roles exist anywhere in this app (only the
generic trade roles plus every real per-resource permission from
`services/permissions.py`'s own catalog); rather than invent
personas, a new `deps.user_permission_codes` helper fetches everything
a user actually holds in one query, and `get_school_dashboard_summary`
independently includes each section only when the calling permission
is real (`students.view`, `admissions.view`, `student_attendance.view`,
`fees.view`, `attendance.view`, `leave.view`, `timetable.view`,
`examinations.view`, `homework.view`, `approvals.view`). A user with
none of these gets a genuinely near-empty response, not a 403 for the
whole page -- live-verified with a role holding only `students.view`:
every other field comes back `null`, every other section `None`,
`needs_attention` empty, and the frontend renders each as an honest
"you don't have permission" line or a "—" tile, never a hidden number
the user was still sent.

**Needs Attention is real, not generic.** A new
`SchoolNeedsAttention` component (mirroring the existing `WorkQueue`'s
own row/severity/positive-state pattern) surfaces only items with a
real non-zero count behind them: admission applications awaiting
review, admission follow-ups overdue (reusing ADR-045's own number),
students below a 75%-attendance threshold over the last 30 days (a
real, newly-written aggregate query), overdue fee accounts, exams
awaiting marks entry, homework overdue-and-unmarked, and staff leave
requests awaiting approval. A category with zero real signal never
appears; an empty list reads as "clear" whether that's because
everything really is clear or because the user's permissions don't
reach that domain -- both are honest positive states, never a
fabricated alert.

**Today's Schedule is real exams and real timetable periods, nothing
invented.** No calendar/meeting/event model exists anywhere in this
codebase, so "Today at school" is built only from `ExamSubjectSchedule`
rows dated today and `TimetableEntry` rows for today's weekday --
chronologically merged, capped at the backend's own top-12-by-time
slice with a real total count (`today_schedule_total_classes`) so the
frontend can honestly say "+N more periods today" with a link to the
full timetable, instead of either flooding the dashboard with every
single period or silently dropping them.

**Fee, Academic, Staff, and Admissions snapshots** are compact,
permission-gated cards below the KPI grid (per the master prompt's own
"group secondary metrics into dedicated sections" instruction) rather
than eight more large tiles -- fee collection rate renders as a real
progress bar off `collected_total / invoiced_total` for the current
academic year, never a decorative gauge.

**Quick Actions are real navigation, with one real deep link.** Seven
actions (Add student, Log admission enquiry, Create application,
Record attendance, Collect fee, Add staff, Create announcement) each
link to the real, already-existing page; "Schedule event" is
deliberately not offered (no event model exists). Five show by
default with a real "View all actions" expand, per the master
prompt's 4-6-visible guidance. "Log admission enquiry" is the one
action wired all the way through: `/admission-enquiries?new=1` now
opens ADR-045's real Log Enquiry drawer via a small, real addition to
`AdmissionEnquiriesPage.tsx` (a `useEffect` reading the query param,
opening the drawer, then stripping the param so a refresh doesn't
reopen it) -- live-verified end to end. The other six actions
navigate to the real page's own existing create entry point one click
away, rather than five more pages each getting new query-param
plumbing in this same pass.

**Recent Activity needed no new component at all.** The existing
`RecentActivity.tsx` (collapsible, remembers its expand/collapse
preference via `useDashboardPrefsStore`, shows a real event count,
"View all activity" link) already satisfied the master prompt's
entire section 10 verbatim -- reused unmodified except for two small,
real additions: `TABLE_META` entries for `students`, `admission_
enquiries`, `admission_applications`, `fee_invoices`, `homework`, and
`examinations` (so school-tenant activity rows get a real label and
deep link instead of the generic fallback), and `recordReference`
extended to recognize `student_name`/`title`/`first_name`+`last_name`
-- real field names these tables' own audit rows already carry, not
new data.

## Deliberately not built in this pass

- **AI-generated School Insights (spec section 12)** -- explicitly
  deferred per the user's own confirmation, consistent with "skip AI
  Copilot for now."
- **New RBAC role personas** (Principal, Teacher, Accountant,
  Admission Counsellor, Transport Manager) and true per-role dashboard
  *layouts* -- named above; this pass gates real data by real
  permissions, it does not invent new roles or render a different
  layout per persona.
- **Dashboard drag-and-drop customization / widget preferences** --
  Phase 3, not attempted; the only "preference" this pass persists is
  Recent Activity's own pre-existing collapse state.
- **Fee concessions in Needs Attention** -- `fees.py`'s own docstring
  already names concessions as not a first-class concept; nothing new
  added here.
- **Timetable conflicts as a Needs Attention item** -- the real
  conflict check in `services/timetable.py` is preventive (rejects at
  creation), so there is no persisted "conflict" state to surface.
- **Transport operational issues** -- no incident/issue model exists
  on `TransportRoute`.
- **A functional academic-year selector** -- the header displays the
  real current academic year as read-only context; every backend
  number is scoped to "the current year" server-side, and no endpoint
  supports querying a different one, so a selector control would have
  had nothing real to switch.
- **Query-param deep-linking on the other six Quick Actions' target
  pages** (Add student, Create application, Record attendance, Collect
  fee, Add staff, Create announcement) -- each already has a real,
  working create entry point one click away on its own page; adding
  `?new=1`-style auto-open to five more pages was out of this pass's
  footprint.

## Verification

Backend: 4 new tests (`test_school_dashboard.py`) exercising the
module gate, an empty-tenant honesty check, a hand-picked-data test
asserting exact KPI/needs-attention/today's-schedule values across
students, fees, homework, admissions, and timetable domains, and the
permission-gating test (a role holding only `students.view` receives
exactly one populated KPI field and every other section `null`/
`None`/empty). Full backend suite: 323 passed, zero regressions.
`tsc --noEmit`, `npm run build` (the stricter `tsc -b` project-
reference check), `npm run check:nav-modules`, and `oxlint` all clean.

Live-verified via CDP headless Chromium against the real, already-
seeded `greenwood-demo` tenant: the full command center rendered with
real numbers (10 active students, 3 new enquiries, a real Needs
Attention feed with three genuine items, a real 3-period timetable for
today, the real admissions pipeline, a real ₹55,000-outstanding/26.7%-
collection-rate fee snapshot); "View all actions" and Recent
Activity's expand both worked; the `/admission-enquiries?new=1` deep
link opened the real Log Enquiry drawer and cleaned its own URL; a
freshly signed-up `building_materials` tenant's dashboard was
confirmed completely unaffected (its original generic KPI tiles,
charts, and WorkQueue rendered unchanged). Mobile viewport (390x844)
verified: the KPI grid drops to two columns, every snapshot card
stacks to full width, no horizontal scroll.

## Reversibility

Every new file is additive (`services/school_dashboard.py`,
`schemas/school_dashboard.py`, `api/v1/school_dashboard.py`, and the
`routes/school/` frontend tree); `deps.user_permission_codes` is a new,
independent helper that touches no existing caller.
`DashboardPage.tsx`'s only change is the one early-return branch and
splitting its existing body into a `GenericDashboard` component with
identical behavior -- reverting either is a small, isolated diff with
no migration to undo.
