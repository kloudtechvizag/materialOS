# ADR-037: School Analytics — computed on read, no fabricated metrics

**Context:** the first Phase 7 slice (Multi-campus, Analytics,
Integrations remain; AI Copilot explicitly skipped by request). Picked
first because it's the lowest-risk, highest-immediate-value piece: no
core architecture changes (unlike Multi-campus, which would touch the
tenant/company model every other ADR in this vertical assumes is
single-school), no external credentials to refuse-until-configured
(unlike Integrations), and it directly showcases the real data every
prior ADR (025 through 036) already produces.

## What shipped

**Zero new tables.** Every number in `services/analytics.py` is
computed on read, straight off tables `StudentAttendanceRecord`,
`FeeInvoice`/`Invoice`/`PaymentAllocation`, `ExamMark`/
`ExamSubjectSchedule`, `HomeworkSubmission`, `BookIssue`,
`StudentTransportAssignment`, and `HostelRoom`/
`StudentHostelAllocation` already write — no cached rollup table to
drift out of sync with the real data, the same "never store what's
cheaply derivable" discipline `BookIssue.status == "overdue"` (ADR-035)
and every report-card percentage (ADR-029) already follow at smaller
scale.

**The one design choice worth naming: a metric with no honest real
denominator is reported as a plain count, not a fabricated
percentage.** `Vehicle.capacity_kg` (the reused core fleet model,
ADR-034) is a freight-unit field, not a passenger seat count -- so
"transport utilization" is reported as "N students on M routes," a
real count, rather than inventing a seat-capacity number this app
doesn't track just to produce a percentage. Hostel occupancy, by
contrast, *is* reported as a real percentage, because
`HostelRoom.capacity` genuinely is a bed count (ADR-036) -- the
distinction is drawn per-metric based on what the schema actually
supports, not applied as a blanket rule either way.

**Homework completion is scoped to "of tracked submissions,"
not "of all assigned work."** The honest denominator would need each
section's full roster size at homework-assignment time (not stored)
to know how many students were *supposed* to submit versus how many
were ever actually marked; rather than approximate that, the metric
counts only students a teacher has actually marked (submitted/late/
missing/pending), labeled accordingly -- verified directly with a
hand-picked 2-of-2-tracked-but-only-1-tracked-as-done case.

**No new categorical chart palette was introduced.** An audit of the
two existing dashboard charts (`SalesTrendChart`, `ReceivablesChart`)
found this app has exactly one real multi-color precedent: a fixed
three-step *status* palette (good/warning/critical) for severity
data, not an arbitrary categorical series palette. Every class/
subject/section breakdown chart here reuses that exact reasoning and
those exact hex values, applied to attendance/collection/performance
health instead of invoice ageing -- not a new, unvalidated palette
invented for this slice. The one time-series (attendance trend) reuses
`SalesTrendChart`'s own single validated blue exactly.

## Deliberately not built in this pass

- **Historical/multi-year comparison** — every metric is scoped to the
  current academic year (or the last 30 days for attendance); no
  year-over-year trend.
- **Export to PDF/Excel** — the existing generic Report Builder
  (`ReportsPage.tsx`, pre-existing) already has CSV export for
  ad-hoc tabular data; this dashboard's charts don't have their own
  export button in this pass.
- **Per-teacher / per-student drill-down analytics** — this is a
  school-wide overview; a teacher's own performance dashboard or a
  single student's analytics view isn't built here.
- **Guardian-facing analytics** — school-wide numbers stay staff-only;
  not surfaced in the Guardian Portal.

## Verification

3 new backend tests (`test_analytics.py`), all through the real HTTP
API: module-gating (403), an honestly-empty tenant returns `null`
percentages rather than `0` or an error (a real distinction --
"nothing recorded yet" is not the same fact as "recorded and it's
zero"), and one comprehensive test that hand-picks exact attendance/
fee/exam/homework/library/hostel/transport data across two classes and
asserts every single computed number precisely (75% overall
attendance, 50%/100% per-class split, 25% fee collection, 70% exam
average, 50% homework completion, exact counts for library/hostel/
transport) -- not just "returns 200." Full backend suite: 298 passed
(295 + 3 new), zero regressions. `tsc --noEmit`, `vite build`, `npm
run check:nav-modules` all clean.

Live-verified against the real, previously-seeded `greenwood-demo`
tenant (`seed_school.py`, itself unrelated to and pre-dating this ADR)
rather than a purpose-built demo -- a stronger test than seeding fresh
data to match the feature, since the numbers had to be independently
hand-computed from that tenant's already-existing real records and
then checked against what the live page actually rendered. Every
number matched exactly: 77.8% attendance (7 of 9 marked-present
records), 6.7% fee collection (₹5,000 of ₹75,000 invoiced), 68.3%/
72.3% average Math/English marks, 66.7% homework completion, and the
correct student/route/bed counts for library, transport, and hostel.
All four bar charts rendered with the correct status color for their
value band (green at 77.8%, red at 6.7%, amber at 68–72%).

## Reversibility

Fully additive, and the smallest-blast-radius slice in this vertical
so far: one new permission resource (own backfill migration, no table
migration needed since nothing new is stored), one new nav item, one
new frontend page. No existing table, model, endpoint, or chart
component was changed -- `SalesTrendChart`/`ReceivablesChart` were
read for their established conventions, never modified.
