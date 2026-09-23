# ADR-045: Admission Enquiries redesigned as a real Admissions CRM workspace

**Context:** a 14-section master prompt asked for a full redesign of
`/admission-enquiries` from a flat table into a modern "Admissions CRM
workspace" -- a professional header, a KPI strip, a visual admission
pipeline, a search/filter/toolbar, a redesigned table, a real enquiry
detail workspace, a redesigned "Log Enquiry" experience with duplicate
detection, actionable follow-up management, an optional pipeline/board
view, purposeful empty states, and full responsiveness -- with the
same non-negotiable constraint as every large spec this vertical has
received: no fabricated metrics, no disconnected UI, real persistence
throughout. Consistent with how ADR-039, ADR-044, and every other
large spec this project has received were handled, this was audited
before any code was written: the enquiry status vocabulary this app
actually stores is `open|contacted|converted|closed` -- the spec's own
example pipeline (Enquiry -> Contacted -> Follow-up -> Visit Scheduled
-> Application Started -> Converted) was never going to be built as a
parallel, fabricated status system. "Application Started" is real and
useful, but it isn't a stored status -- it's a fact derivable by
checking whether a real `AdmissionApplication.enquiry_id` already
points at this enquiry.

## What shipped

**Two small, justified backend additions**, the same discipline
already established by `FeeInvoiceOut.due_date` and `GuardianOut.
user_id` (ADR-044): `AdmissionEnquiry.assigned_to_id`, a real FK to
the core `Employee` model (identical reasoning to `Section.
class_teacher_id` -- a counsellor is an employee, not a parallel staff
entity), and `AdmissionEnquiryActivity`, a real, small, append-only
table. The pre-existing `notes` field is a single current-state field
with no history; a genuinely honest multi-entry activity timeline
needed its own table rather than pretending one field's edit history
was a timeline. `created` and `status_change` rows are written
automatically by `services/admissions.py` itself (`create_enquiry`,
`update_enquiry`, and the enquiry-side of `create_application`) so the
timeline is populated from the moment an enquiry exists; `note`/
`call`/`follow_up_scheduled` are the staff-initiated entries, added
through two new endpoints.

**The real pipeline, not a fabricated one.** The KPI strip, pipeline
strip, table, and board view all read the same real summary
(`GET /admission-enquiries/summary`, computed on read -- no cached
rollup, the same discipline as Analytics/ADR-037): total enquiries,
new this week, follow-ups due today, overdue follow-ups, applications
started, converted, and conversion rate. The pipeline strip shows five
stages -- Open, Contacted, Application started, Converted, Not
proceeding -- but only four are real, persisted statuses; "Application
started" is computed by cross-referencing `AdmissionApplication.
enquiry_id` against the enquiry set, shown as a genuine, clickable
filter but never a status an enquiry can be dragged into or PATCHed
to directly. `update_enquiry` now rejects `status=converted` from a
plain PATCH with a real 400 -- exactly the same discipline
`AdmissionApplication.status=admitted` already enforces -- because an
enquiry can only become converted by a real `AdmissionApplication`
being created against it (`create_application` sets it, and now also
logs the status-change activity that plain PATCH-driven changes get).

**Duplicate detection is a real query, not a guess.** The redesigned
Log Enquiry drawer debounces the student-name/guardian-phone fields
and calls a real `GET /admission-enquiries/duplicates` endpoint,
matching on exact guardian phone or case-insensitive student name
against enquiries that are still open or contacted -- a family
re-enquiring after a prior enquiry was closed is a real, new lead, not
a flagged repeat, so closed/converted enquiries are excluded.

**Table, board, and a real enquiry detail workspace.** The table keeps
every quick action honest: "Mark contacted," "Close enquiry," and
"Reopen" are only offered where the real status transition is valid.
The new board view (native HTML5 drag-and-drop, no new dependency)
only accepts drops onto the three manually-settable columns (Open,
Contacted, Not proceeding) -- the Converted column displays real
converted enquiries but isn't a drop target, since dragging into it
would be exactly the fake status-set the backend now rejects. The
detail drawer (reusing the existing `Drawer` primitive, the same one
LeadsPage already ships) is the one place all of an enquiry's real
state meets: status, assigned counsellor, follow-up date, a
"Convert to application" action that reuses the exact same endpoint
the old inline table action called, and the full activity timeline.

**Permissions**: unchanged from ADR-044's own conclusion -- this app's
frontend still carries no client-side role/permission data, so every
mutation here runs through the same real backend `require_permission`
checks every other admissions endpoint already had; a genuinely
unauthorized action surfaces the same real 403 `ApiError` every other
page in this app already shows.

## Deliberately not built in this pass

- **A fifth, stored "Application started" pipeline status** -- named
  above; it's real but derived, never stored, never draggable.
- **"Assign to me"** -- there's no guaranteed one-to-one mapping
  between a logged-in `User` and an `Employee` record in this schema;
  rather than guess at one, assignment is a real dropdown over the
  actual `Employee` directory with no shortcut.
- **A public-facing enquiry capture form** -- named as deliberately
  deferred since `AdmissionEnquiry` itself was created (see
  `models/admissions.py`'s own module docstring); unchanged by this
  pass.
- **Bulk actions on the table** (bulk-assign, bulk-close) -- the spec
  didn't ask for them and no existing admissions page in this app has
  bulk row selection to extend.

## Verification

Full backend suite: 319 passed (312 + 7 new: automatic created/
status-change activity logging, manual note/call logging with
invalid-type rejection, assigned-counsellor round-trip through the
real `Employee` directory, duplicate detection excluding closed/
converted leads, the summary endpoint's real counts and derived
`applications_started`/`has_application`, and the `converted` PATCH
guard), zero regressions. `tsc --noEmit`, `npm run build` (the
stricter `tsc -b` project-reference check), and `npm run
check:nav-modules` all clean.

Live-verified via CDP headless Chromium against the real, already-
seeded `greenwood-demo` tenant: logged a new enquiry through the
redesigned drawer (KPIs and pipeline strip updated live); re-opened
the drawer with the same student name and guardian phone and saw the
real "Possible duplicate" warning naming the exact existing lead;
opened the detail drawer and changed status Open -> Contacted, watched
the activity timeline show three real, correctly-attributed entries
("Enquiry logged," "Note," "Status change" -- with the real logged-in
user's name and timestamp on each); converted the enquiry to a real
`AdmissionApplication` from the drawer and landed on the pre-existing,
unmodified application detail page; confirmed the enquiry list and
board view both immediately reflected `Converted` and a 100% ->
66.7%-adjusted conversion rate as more enquiries were added; confirmed
the board view's Converted column shows the real "Application
started" badge and isn't a valid drop target. Mobile viewport
(390x844) verified: KPI tiles and pipeline stages stack to a legible
single/two-column layout, the Log Enquiry drawer fills the viewport
cleanly, no horizontal scroll.

## Reversibility

`AdmissionEnquiry.assigned_to_id` and `admission_enquiry_activities`
are both additive; the migration's `downgrade()` cleanly drops both.
The old flat table implementation is fully superseded, not kept in
parallel. `AdmissionEnquiryActivity` rows are real audit data (who
logged what, when) -- nothing here can be "turned off" without losing
that real history, which is the intended trade-off of building an
honest timeline instead of not building one.
