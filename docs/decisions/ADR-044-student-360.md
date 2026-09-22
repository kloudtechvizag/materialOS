# ADR-044: Student 360 — a tabbed command-center redesign, built entirely on data that already existed

**Context:** a 41-section master prompt asked for a complete redesign
of the Student Profile into "Student 360" — a header, KPI strip,
Needs Attention panel, and eleven tabs (Overview, Academics,
Attendance, Fees, Guardians, Documents, Transport, Homework,
Examinations, Communication, Timeline), plus several genuinely new
backend concepts (student photo upload, internal Notes, Achievements,
a Student Requests workflow, a Draft→Published report-card approval/
versioning workflow, an expanded status workflow with audit, AI
Student Insights). Consistent with how every large spec this project
has received has been handled, this was audited and sliced before any
code was written — the user confirmed the split explicitly: build the
full tab-based redesign now, on 100% real data the vertical already
produces across ADR-025 through ADR-043; name everything that needs
new backend infrastructure as deliberately deferred rather than
building it half-real. AI Student Insights was confirmed excluded,
consistent with the standing "skip AI Copilot for now" instruction
this whole vertical has followed since Phase 7 began.

## What shipped

**The old `StudentDetailPage.tsx`** (one 483-line file, eight stacked
cards, one flat scroll) **is now a real shell** over twelve new files
under `routes/education/student360/`: a shared `types.ts`, a
`StudentHeader`, a `NeedsAttention` panel, and one component per tab
(`OverviewTab`, `AcademicsTab`, `AttendanceTab`, `FeesTab`,
`GuardiansTab`, `HomeworkTab`, `ExaminationsTab`, `TransportTab`,
`LibraryTab`, `HostelTab`, `EnrolmentTab`, `TimelineTab`) plus a
shared `timelineEvents.ts` event-synthesis helper Overview and
Timeline both call. Every one of these reads from an endpoint that
already existed before this ADR — `/students/{id}`, `/enrolments`,
`/guardians`, `/student-attendance`, `/fees`, `/homework`,
`/examinations` + per-exam report cards, `/transport`, `/library`,
`/hostel`, `/audit-logs` — no new domain data was invented to fill a
tab.

**SPA tab navigation, no page reload.** Selecting a tab is local React
state; only that tab's own `useQuery` fires (each Tab component owns
its data fetching, so switching tabs for the first time is the only
moment its query runs — React Query then caches it). The shell itself
only eagerly fetches what the header, KPI strip, and Needs Attention
panel genuinely need up front (student, enrolments, guardians,
attendance, fees, homework, examinations list, transport) — Library,
Hostel, per-exam report cards, and the audit log are real,
tab-specific queries that were previously all fetched unconditionally
on page load in the old flat page. This is a real reduction in
eager network calls, not a token gesture toward the performance
requirement.

**KPI strip and Needs Attention compute from real data only.**
Attendance %, fee balance, homework-pending count, next unlocked exam,
transport route, and guardian count are the same numbers their
respective tabs show — never a separate, potentially-drifting
calculation. Needs Attention fires exactly five alert types, each with
a real underlying signal: fee overdue (invoice `due_date` — see below
— has passed with real outstanding balance), attendance below a named
threshold (75%, not yet tenant-configurable — no configurable
threshold mechanism exists for attendance the way `Item.reorder_level`
exists for stock, named as a real limit), homework overdue-and-still-
unmarked, no guardian linked, and parent portal not activated. Alert
types with no real underlying signal in this codebase yet — transport-
missing (most students legitimately don't take a bus), medical-
info-incomplete (only `blood_group` exists and is rarely filled; firing
on it would be noise, not signal), report-card-awaiting-approval (no
approval workflow exists) — were deliberately left out rather than
manufacturing urgency the data doesn't support.

**Two small, real backend field exposures** made the above honest
rather than approximate: `FeeInvoiceOut.due_date` (the earliest
`FeeStructureItem.due_date` across an invoice's own lines — real,
already-stored data, just never returned before) and
`GuardianOut.user_id` (already a real column, never exposed).

**A real bug was found and fixed along the way, not worked around.**
`services/guardian_portal.py::create_guardian_portal_login` has, since
ADR-032, created a real, working `User` linked via `User.guardian_id`
— but never set the back-reference `Guardian.user_id`, despite that
field's own docstring describing exactly this as its purpose ("link it
when self-service actually activates"). Every guardian ever granted
real portal access read as "inactive" everywhere that field was
checked — caught live, against the real `greenwood-demo` tenant, when
Needs Attention flagged a guardian this session had personally logged
into the portal with minutes earlier. Fixed at the source (one line),
backfilled for every existing tenant (migration `c4d5e6f7a8b9`, a pure
data repair — only sets `user_id` where a real matching `User` row
already exists, no new default), and covered by a new regression test
(`test_granting_portal_access_sets_the_real_guardian_user_id_link`).

**Print, not a new PDF library.** "Print profile" (header) and "Print"
(Examinations tab, on a selected report card) both reuse ADR-040's
`data-print-area` mechanism. Only one `data-print-area` can be live at
once (browsers apply `position: absolute; inset: 0` to each), so the
page-level profile summary is conditionally withheld while the
Examinations tab is active, letting that tab's own report-card print
area take over cleanly instead of the two colliding.

**Permissions**: per spec section 34's own instruction ("never rely
only on frontend hiding... enforce in the backend/API"), and because
this app's frontend has no client-side permission/role data at all
today (confirmed by auditing `useAuthStore` — no role or permission
array reaches the browser, only the module-level nav gating every
other page in this app already relies on) — no new frontend
permission-hiding was invented for Student 360 specifically. Every
mutation here already runs through the same real `require_permission`
backend checks every other page's mutations do; a genuinely
unauthorized click surfaces the same real 403 `ApiError` every other
action in this app already shows. Building a fake client-side "can I
see this button" check with no real permission data behind it would
have been exactly the kind of dishonest UI this project's own
principles forbid.

## Deliberately not built in this pass

- **Student photo upload** — the header shows a real, legible initials
  avatar; no upload wiring exists yet. The exact `Item.image_path` /
  `app.storage` pattern ADR-041 already proved out would be the real
  follow-up, not a new mechanism.
- **Documents tab, Communication tab** — no student-level document
  vault exists yet (`AdmissionDocument`, ADR-041, is
  application-scoped, not student-scoped); no unified cross-channel
  communication log exists (Announcements + `NotificationDelivery`,
  ADR-043, are the real pieces that exist, not yet merged into one
  per-student thread). Left out of the tab bar entirely rather than
  shipped as an empty shell with nothing behind it.
- **Internal Notes, Achievements & Activities, Student Requests
  workflow** — no backing tables exist; named, not stubbed.
- **Report card Draft→Under Review→Approved→Published→Amended
  workflow and versioning** — `Examination.is_locked` remains the only
  real state (locked = results finalized); a multi-stage approval
  pipeline is real, separate, later work.
- **Expanded student status workflow with structured reason + audit
  trail** — `Student.status` still uses its existing five-value
  vocabulary (active/transferred/withdrawn/alumni/inactive); a status
  change is still a plain `PATCH`, captured by the generic `audit_trg`
  trigger (old value → new value, real), not a dedicated
  reason-required workflow table.
- **AI Student Insights** — explicitly excluded per the user's own
  confirmation, consistent with "skip AI Copilot for now."
- **Global student search by guardian name/phone/class** — the
  existing search endpoint doesn't index students at all yet; out of
  this page's own scope.
- **Client-side permission-based UI hiding** — named above; this app
  has no client-side permission data to hide with honestly.

## Verification

Full backend suite: 312 passed (311 + the new guardian-portal
regression test), zero regressions from the two schema field additions
and the `create_guardian_portal_login` fix. `tsc --noEmit`, `npm run
build` (`tsc -b`, the stricter project-reference check), and `npm run
check:nav-modules` all clean.

Live-verified via CDP headless Chromium against the real,
already-seeded `greenwood-demo` tenant across every tab: Overview
(real personal details, honest "Not recorded" placeholders instead of
bare dashes), Academics (real class placement; honest "No assessment
data yet" empty state for the tenant's one unlocked exam), Attendance
(real 100%/3-present/0-absent/0-late stats, a real per-day calendar
grid built from actual attendance dates), Fees (real ₹15,000
assigned/paid/₹0-outstanding breakdown reflecting a real payment
recorded earlier in this same session via ADR-042's gateway), Guardians
(real "Portal active" status — the exact bug fix above, confirmed live
before and after), Examinations (honest "Results pending" pill for the
unlocked exam), Enrolment History (real campus, real class teacher,
real dates), Timeline (a real chronological feed: fee invoice
generated, fee invoice fully paid, student record created — sourced
from the real audit log's own INSERT row — assignment submitted, each
filterable by category). "Print profile" verified under
`Emulation.setEmulatedMedia({media: "print"})`: a clean, self-contained
printed summary with the app shell fully hidden. Mobile viewport
(390×844) verified: header stacks vertically, action buttons wrap into
readable rows, KPI tiles stack two-per-row, tab bar scrolls
horizontally — a real responsive layout, not a shrunk desktop one.

## Reversibility

The old flat-page implementation is fully superseded, not kept in
parallel — `StudentDetailPage.tsx` is now the shell, and the twelve
`student360/` files are the real page. No backend table was changed
beyond two additive schema fields and one bug fix + backfill migration
(itself independently reversible — deleting the migration's effect
just means `Guardian.user_id` reads `NULL` again for guardians whose
portal access predates the fix, the exact pre-existing state). Every
tab is an independent component; removing or replacing any one of them
doesn't touch the others.
