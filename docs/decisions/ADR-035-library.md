# ADR-035: Library — a new circulation domain, not a forced fit onto existing catalog/serial infra

**Context:** the second Phase 6 slice, picked over Hostel since every
student can plausibly use it, unlike Hostel's boarder-only subset.
Before writing any model, this ADR checked two existing candidates for
reuse, the same discipline Transport (ADR-034) applied to Vehicle/
Driver:

- **The core `Item` catalog** — rejected. `Item` is universal across
  every industry and would need author/ISBN/publisher fields bolted
  on for this one vertical, the same kind of pollution this codebase
  avoided by giving `FeeHead` (ADR-031) and `Subject` (ADR-028) their
  own small models instead of stretching `Item`. A library book also
  has no real GST/pricing need the way a fee line genuinely did.
- **`SerialUnit`** (`models/serial.py`, individually-tracked units
  with warranty/RMA history) — also rejected. Its status vocabulary
  (`in_stock → sold → returned/under_repair`) and FKs
  (`purchase_bill_item_id`, `invoice_item_id`, `warranty_expiry`) are
  shaped for retail warranty tracking, not circulation. Forcing
  "issued" through a field built for "sold" would be the same kind of
  mismatch that already correctly ruled out `Trip` for Transport.

Circulation (issue/return/overdue/fine) is genuinely new domain logic
this codebase didn't have a shape for yet.

## What shipped

**Three new tables** (`models/library.py`, migration `ba6a231d6400`):

- `Book` — title-level catalog (title, author, ISBN, publisher,
  category).
- `BookCopy` — one physical, individually-trackable copy per
  accession number; a library's real unit of circulation is the copy,
  not the title (two copies of the same book can have different
  availability at the same time).
- `BookIssue` — one circulation transaction. `"overdue"` is
  deliberately **not** a stored status — it's derived
  (`status == "issued" and due_date < today`), the same "never store
  what's cheaply derivable" discipline `ReportCard` percentages
  (ADR-029) and `Homework` roster status already follow.

Same RLS + `audit_trg` + permission-backfill-migration treatment as
every table this vertical has added (`eb22dcc13664`) — one resource,
`"library"`, covering all three tables.

**The one design choice worth naming: fines are tracked directly on
`BookIssue`, not routed through the Invoice/Receipt pipeline the way
Fee Management (ADR-031) reused it for tuition fees.** A fine is a
real amount (`fine_amount`, `fine_paid`), auto-calculated at return
time (`FINE_PER_DAY * overdue_days`, a fixed default — not per-school
configurable in this pass, same scope limit `Examinations`' grade
bands already accepted) but always overridable by staff on return.
This keeps Library self-contained and independently reviewable,
matching how every other non-fee education module (Homework,
Timetable, Transport) stayed outside the accounting system; full
Invoice/Receipt integration for fines is a real, separate future
decision, not an oversight.

**Frontend**: `LibraryPage` — book catalog with inline copy
management, and an issue/return workflow with a cascading class →
section → student picker (reusing the `section_id` filter on
`GET /students` that Transport, ADR-034, added). Marking a copy "Lost"
keeps it permanently unavailable while a *fresh* copy of the same
title remains issuable — verified directly. `StudentDetailPage` and
`GuardianPortalChildPage` both gained a real Library card (title,
accession number, issued/due/returned dates, fine, overdue badge) —
the same `get_student_library_history` call underneath both, the
guardian-portal one wrapped in the same `_owned_student` ownership
check every other guardian-portal read uses.

## Deliberately not built in this pass

- **Fine collection through Invoice/Receipt** — named above; today a
  fine is a tracked figure, not a billed, collectible receivable.
- **Reservations / holds** — no "reserve this book when it's
  returned" queue.
- **Barcode/RFID scanning** — accession numbers are typed, not
  scanned; a real scanner integration is a device-layer concern this
  pass doesn't touch.
- **Renewals** — a book can only be returned, not extended in place;
  a renewal today is staff manually returning and re-issuing.
- **Per-class/grade borrowing limits** — nothing stops one student
  holding many books at once.

## Verification

7 new backend tests (`test_library.py`), all through the real HTTP
API: module-gating (403), issuing a book marks the copy `issued` and
surfaces it in the staff-wide active-issues list, issuing an
already-issued copy is rejected (409), returning on time computes a
real zero fine and frees the copy, staff can override the fine amount
on return, marking a book lost keeps that specific copy permanently
unavailable while a fresh copy of the same title remains issuable, and
the Guardian Portal reflects the same real history through the
existing ownership check. Full backend suite: 288 passed (281 + 7
new), zero regressions. `tsc --noEmit`, `vite build`, `npm run
check:nav-modules` all clean.

Live-verified end to end on a fresh "Library Test School" tenant, the
full staff-side flow through the UI with no seed data: added a real
book and copy, issued it to a real student via the cascading picker,
confirmed the copy's status flipped to `issued` on screen, and
confirmed the exact same real issue (title, accession number,
issued/due dates) appeared on the student's own staff-facing profile
page and — after logging in as that student's actual guardian —
identically in the Guardian Portal. Returned the book through the UI
with a manual ₹10 fine override and cross-verified via a direct API
call that the fine, `returned_date`, and `status: "returned"` all
persisted exactly as entered, with the copy's roster clearing.
(Two real slip-ups caught and fixed along the way, neither an app
bug: a shell variable from an earlier tool call didn't persist across
a new Bash invocation, silently producing a portal-login email with
an empty tenant slug — caught immediately by the resulting login
failure and fixed by re-reading from the seeded file; and the staff
JWT access token expired mid-session during the ~30-minute walkthrough,
producing a "feature not enabled" false alarm until a fresh token was
issued and re-injected.)

## Reversibility

Fully additive: three new tables (own migration + downgrade), one new
permission resource (own backfill migration), one new nav item, one
new staff page, one new card each on `StudentDetailPage` and
`GuardianPortalChildPage`. No existing table, model, or endpoint was
changed.
