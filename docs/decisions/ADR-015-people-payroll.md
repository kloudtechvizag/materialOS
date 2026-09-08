# ADR-015: People & Payroll — a real workforce operating system, scoped honestly

**Context:** the directive is explicit and repeated: "Do not build an
employee CRUD application... Build the People & Payroll module as a
first-class MaterialOS business module." The spec's own 110 sections
span org structure, shift rostering, geo-fenced/biometric attendance,
leave, overtime, timesheets, a full payroll engine with statutory
deductions, commission, performance management, onboarding/
offboarding workflows, a mobile app, and cross-module Employee 360
reporting. Building all of it in one pass would violate this
project's own scope discipline (Master Brief Part G8: "scope creep is
the primary failure mode"). This pass builds the core chain the spec
itself draws first — Employee → Department/Designation → Shift →
Attendance → Leave → Payroll → Payslip → Accounting — as real, load-
bearing, live-verified code, and explicitly defers the rest below
rather than approximating it.

## Data model

Same platform-vs-tenant split as every other module this session:
everything here is tenant-scoped (RLS+audit) — there's no platform-
level HR catalog the way `Plan`/`Feature` are for billing, since org
structure is entirely per-tenant.

- **`models/hr.py`**: `Department`, `Designation`, `Employee` (the
  central master), `EmployeeHistory` (the timeline, spec §7),
  `Shift`, `ShiftAssignment`, `HolidayCalendar`/`Holiday`.
- **`models/attendance.py`**: `AttendanceRecord` (one row per employee
  per day), `AttendanceCorrection`.
- **`models/leave.py`**: `LeaveType` (policy fields folded in — see
  below), `LeaveBalance`, `LeaveRequest`.
- **`models/payroll.py`**: `SalaryComponent` (tenant-configurable
  earnings/deductions catalog), `EmployeeSalaryAssignment` (versioned
  — a revision is a new row, never an overwrite, spec §37),
  `PayrollRun`, `PayrollItem` (doubles as the payslip — see below),
  `EmployeeAdvance`.

**`Employee.user_id` is nullable, by design.** Not every employee
needs system login (a production worker or driver may exist purely
for attendance/payroll tracking) — self-service (spec §63) only
activates once HR links a real `User` to the employee row
(`PATCH /employees/{id}` with `user_id`), validated to belong to the
same tenant and not already linked elsewhere.

**`Driver` (`models/fleet.py`, pre-existing) is not merged into
`Employee`.** Spec §21 wants driver attendance tied into the same
system; unifying two established entities used across Fleet/Dispatch
is real, separate migration work this pass doesn't do — recorded as
accepted debt, not silently ignored.

**`PayrollItem` *is* the payslip** — there is no separate `payslips`
table. Once a `PayrollRun` is `locked`/`paid`, its `PayrollItem` rows
are read-only in practice (nothing above `calculate_payroll_run`
touches a non-recalculable run) and carry everything a payslip needs:
days worked/LOP, the full earnings/deductions breakdown (JSONB, same
"flexible line items don't need their own table" reasoning as
`Backup.table_counts`), net pay, and per-employee exceptions.

**`LeaveType` folds in policy fields** (`annual_allocation_days`,
`allow_half_day`, `is_paid`) rather than a separate `leave_policies`
table — every tenant's actual policy today is "this type, this many
days, paid or not"; a real accrual/expiry/encashment engine (spec
§27) is future scope with nothing to normalize yet.

## Entitlement gate: `employee_compensation` is its own resource

Spec §77 is explicit: "salary information must have separate
permissions from basic employee information." `EmployeeOut` (the
default employee-read schema) excludes bank/PAN/statutory-ID fields
entirely; `GET /employees/{id}/compensation` is a separate endpoint
gated by `employee_compensation.view`/`.edit`, distinct from
`employees.view`/`.edit`. A payroll admin does not automatically get
document/HR-file access, and vice versa — matching spec §107's own
"payroll administrators should not automatically have access to every
HR document" (though document *storage* itself, spec §59, is
deferred — see below).

## The payroll engine (spec §34-52, §83, §109)

`services/payroll.py`'s `calculate_payroll_run` is the real
calculation core: per employee, it resolves the currently-effective
`EmployeeSalaryAssignment`, computes `working_days` (calendar days
minus Sundays — see deferred list), `present_days` from
`AttendanceRecord`, `paid_leave_days` from approved `LeaveRequest`s
joined to `LeaveType.is_paid`, derives `lop_days` and a `pay_ratio`,
then prices every active tenant-configured `SalaryComponent` against
the employee's stored `basic`/`monthly_gross` (never the other way
around — see the component-catalog note below), applies advance
repayment deductions, and writes one `PayrollItem` per employee with a
full earnings/deductions breakdown.

**Blocking vs. non-blocking exceptions (spec §46) are real, not
decorative.** `approve_payroll_run` refuses outright — 400, naming
every affected employee — if any `PayrollItem` carries a
`missing_bank_details` or `missing_salary_structure` exception.
Live-verified: an employee with neither correctly blocked approval;
fixing the exception (or excluding the employee via status change) and
recalculating correctly cleared it.

**State machine is a real gate, not just a status label.**
`calculate_payroll_run` refuses once a run is
`approved`/`locked`/`paid`/`cancelled`; `approve_payroll_run` only
accepts `calculated`; `lock_payroll_run` only accepts `approved`
(and is what actually posts the accounting journal — see below);
`pay_payroll_run` only accepts `locked`. Live-verified end to end,
including the recalculation refusal after locking.

**Salary components price relative to the employee's own stored
`basic`/`monthly_gross`, never the other way around.** An earlier
version of the seeded component catalog defined "Basic" itself as a
percentage-of-gross `SalaryComponent`, which is circular (gross is
partly *made of* basic) — caught before it shipped, not live. Fixed
by keeping `EmployeeSalaryAssignment.basic`/`.monthly_gross` as the
two directly-assigned numbers (spec §37's own model) and pricing every
other component (HRA, conveyance, PF, PT, ...) relative to those.

## Journal integration (spec §51-52)

`Salary Expense` (`5100-SALARY`), `Payroll Payable`
(`2200-PAYROLL-PAYABLE`), and `Employee Advances` (`1400-EMP-ADVANCES`)
were added to `services/accounts.py`'s system account seed. `Dr Salary
Expense` (per employee, tagged with the employee's `Department`'s own
`CostCenter` — reusing the pre-existing `center_type="department"`
dimension rather than inventing a parallel one) `= Cr Payroll Payable`
(net pay owed) `+ Cr Employee Advances` (advance repayment reduces
that asset, not a generic payable) `+ Cr Payroll Payable` again for
other statutory deductions (PF/PT — a real simplification: production
systems use distinct PF Payable/PT Payable/TDS Payable accounts per
component, not one shared bucket). `pay_payroll_run` posts
`Dr Payroll Payable = Cr Bank`, reading back exactly what was credited
to Payroll Payable at lock time (not recomputed from the run's summary
totals) so the advance-vs-payable split from locking is never
double-counted.

Every `PayrollRun` posts against the company's first `Branch`
(`JournalEntry.branch_id` is required and payroll runs at the company
level, with no branch of its own) — a real, documented simplification,
not silently guessed; a genuinely multi-branch employer whose payroll
should split by the *employee's own* branch is a follow-up, not built
here (department-level cost-center allocation already carries the
more commonly-needed reporting dimension).

## Bugs found only by live verification against the running containers

Consistent with this project's standing practice, five real bugs
surfaced only by actually calling the new endpoints end to end — none
caught by writing the code, and most not even caught by the first
draft of the automated test suite (each test signs up a fresh tenant
and drives a short, deliberate sequence, which doesn't naturally
exercise "recalculate after a mid-cycle status change" or "an employee
with zero attendance this period"):

1. **`payroll.calculate`/`payroll.lock`/`payroll.pay` aren't valid
   permission codes** — `services/permissions.py`'s `ACTIONS` list
   didn't include `"calculate"`, `"lock"`, or `"pay"` (spec §77's own
   exact permission list), so `ensure_permission_catalog()` never
   generated those codes and `POST /payroll/runs` returned a real 403
   for a brand-new tenant's own owner. This is the same bug class
   fixed twice already this session (ADR-013's addendum,
   ADR-014) — caught this time by actually calling the endpoint, and
   fixed with a third backfill migration
   (`f1c8e34b7a02_backfill_payroll_action_permissions.py`) spanning
   every existing resource, since `ACTIONS` changed globally rather
   than one resource gaining new codes.
2. **Recalculating a payroll run left stale `PayrollItem` rows** for
   an employee who became inactive (e.g. resigned) between two
   `calculate` calls — the query only ever *adds/updates* items for
   currently-active employees, never removes ones that fell out of the
   active set. Fixed by deleting any `PayrollItem` whose employee is
   no longer in the active set at the start of every recalculation.
3. **`JournalEntry.branch_id` is `NOT NULL`, but payroll has no single
   branch** — the first `lock_payroll_run` call failed with a real
   `IntegrityError` (`null value in column "branch_id"`). Fixed with
   `_main_branch()`, resolving the company's first branch (documented
   simplification above).
4. **Deductions could exceed earnings and produce a negative
   payslip** — an employee with zero attendance in a period (no
   present days, no approved leave) still had a full flat deduction
   (Professional Tax, ₹200) applied against ₹0 gross, and — worse — a
   full advance instalment was unconditionally subtracted from the
   advance's `outstanding_amount` *before* checking whether the
   employee's pay could actually cover it, permanently marking money
   "repaid" that was never actually withheld from anyone. Fixed in two
   parts: advance deductions are now computed as *candidates* and only
   applied (mutating `outstanding_amount`) up to the employee's actual
   pay headroom, deferring any shortfall to a future period (surfaced
   as a real, non-blocking `advance_deduction_deferred` exception); and
   `net_pay` is floored at 0 rather than going negative when statutory
   deductions alone exceed a low/zero prorated gross (surfaced as
   `deductions_exceed_earnings`).
5. **The floor from bug 4 could itself unbalance the journal** —
   flooring `net_pay` at 0 while still crediting the *full*
   (unfloored) `total_deductions` to Payroll Payable/Employee Advances
   would post more credit than the gross-earnings debit covers. Fixed
   by deriving the postable deduction split from
   `gross_earnings - net_pay` (balanced by construction for every
   item, always) rather than from `PayrollItem.total_deductions`
   directly, which can legitimately exceed what was actually
   collectible. Verified directly against `journal_lines`: every
   payroll run posted in this session's testing — including one
   specifically constructed to hit this exact edge case — has
   `SUM(debit) = SUM(credit)`.

## Explicitly deferred (backlog, not this pass)

- **Mobile app, offline attendance sync, real biometric/QR/geofencing
  device integration** (spec §16-19, §87-89) — `AttendanceDeviceProvider`
  is a real adapter *interface* (`services/attendance.py`), with
  `ManualAttendanceProvider` (web self-service clock-in/out) as the
  one real implementation, same reasoning as ADR-012's barcode-scanner
  note: there is no hardware in this environment to integrate against,
  and no fake "device connected" state is worth shipping. Geofencing
  specifically would need a company/branch location + radius setting
  and consent tracking — real, separate scope.
- **Shift times are timezone-naive**, combined with UTC at
  clock-in/out time (`services/attendance.py`) — correct for a
  deployment whose Postgres/app timezone matches the business's own,
  wrong otherwise. A real fix needs a company-level timezone setting;
  noted here rather than silently shipping a subtly-wrong "late"
  calculation for non-UTC-aligned businesses without disclosure.
- **A full weekly roster/calendar UI** (spec §14) — `ShiftAssignment`
  is a real, effective-dated model (see models/hr.py's own docstring
  for why), but no drag-and-drop weekly grid was built on top of it.
- **Commission, timesheets tied to projects/printing jobs, performance
  management, a full onboarding/offboarding checklist workflow, HR
  document storage with expiry reminders, company announcements, an
  org chart view, employee expense reimbursement** (spec §33, §39,
  §42, §58-61, §68, §104) — each is real, separate scope with its own
  workflow and (for expenses/commission) its own accounting
  integration; none shares enough structure with what this pass built
  to bolt on cheaply. `Employee.status` already covers the
  onboarding/offboarding *states* the spec's checklist would move
  between (Probation → Active → On Notice → Resigned/Terminated) —
  what's missing is the guided checklist UI, not the state model.
- **Real Indian statutory PF/ESI/TDS rate tables** — `SalaryComponent`
  is genuinely tenant-configurable (spec §85's own instruction: "do
  not hardcode state-specific or time-sensitive statutory values"),
  seeded with illustrative defaults (12% PF, flat ₹200 PT) an admin is
  expected to correct for their actual jurisdiction, same "the
  interface is real, the numbers are not authoritative" pattern as
  ADR-004's tax-rate-table precedent.
- **A carried-forward advance-deduction shortfall becoming next
  period's opening deduction** — today a deferred amount is visible
  (the `advance_deduction_deferred` exception) but not automatically
  re-attempted; `EmployeeAdvance.outstanding_amount` is untouched for
  the deferred portion, so it's simply picked up again whenever the
  employee's pay next has headroom — a manual/next-run recheck, not an
  automated retry queue.
- **Cross-module Employee 360** (spec §105-106: sales/collections/
  visits/dispatch tied to an employee's own profile) — no
  `salesperson_id`/`employee_id` linkage exists yet on `Invoice`,
  `Receipt`, or `Visit` (Slice 2's field-sales check-in uses a raw
  `salesperson_user_id`, not `Employee`); wiring this is a real,
  broader change touching Slice 1/2/3 models this pass doesn't make.

## Frontend (spec §91-101)

`/people` (overview: real live headcount/present/absent/late/on-leave
counts and department distribution, `GET /people/overview`),
`/people/employees` (+ detail: profile, gated compensation panel,
timeline, salary assignment), `/people/attendance` (self clock-in/out
+ today's team view + correction review), `/people/leave` (request +
balance + team approval queue), and `/people/payroll` (+ run detail:
the full calculate → approve → lock → pay pipeline with blocking-
exception call-outs and a per-employee payslip breakdown) are real,
live-verified pages reading from the endpoints above — a "People &
Payroll" navigation section, gated per-item by the same RBAC
permissions the backend enforces. A full command palette (spec §92),
org chart (§104), and role-specific pre-built dashboards beyond the
one Overview page (§93) are not built — the single Overview page
already surfaces what every role's dashboard would show a subset of,
and a command palette is an app-wide UX feature, not specific to this
module.
