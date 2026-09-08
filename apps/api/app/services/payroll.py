"""ADR-015 (spec sec34-52, sec83, sec109). The payroll calculation
engine and its approval/lock/pay state machine. Payroll is treated as
a high-integrity financial record: `calculate_payroll_run` refuses to
touch anything once the run is `approved`/`locked`/`paid` (recompute
happens only in `draft`/`calculated`), `approve_payroll_run` refuses
if any employee has a blocking exception (spec sec46), and once
`locked`, a run's PayrollItems are never silently edited again --
`unlock_payroll_run` exists as an explicit, audited reversal, not a
quiet re-open.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.accounting import JournalEntry, JournalLine
from app.models.attendance import AttendanceRecord
from app.models.hr import Department, Employee
from app.models.leave import LeaveRequest, LeaveType
from app.models.payroll import EmployeeAdvance, EmployeeSalaryAssignment, PayrollItem, PayrollRun, SalaryComponent
from app.models.tenant import Branch
from app.services.accounts import ensure_default_accounts, get_account
from app.services.hr import ensure_default_salary_components
from app.services.notification_rules import fire_trigger

ACTIVE_PAYROLL_STATUSES = {"active", "probation", "on_notice", "on_leave"}
NON_RECALCULABLE_STATUSES = {"approved", "locked", "paid", "cancelled"}
TWO_PLACES = Decimal("0.01")


def _main_branch(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> Branch:
    """Every JournalEntry requires a branch_id (B6's own convention --
    see JournalEntry's own NOT NULL constraint); payroll runs at the
    company level, with no single branch of their own, so this posts
    against the company's first branch. A multi-branch employer whose
    payroll should split by the *employee's own* branch, not just the
    company's first one, is a real refinement this pass doesn't make
    (see ADR-015's deferred list) -- cost-center allocation by
    department already carries the more commonly-needed dimension."""
    branch = db.execute(select(Branch).where(Branch.tenant_id == tenant_id, Branch.company_id == company_id).order_by(Branch.created_at)).scalars().first()
    if branch is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This company has no branch to post the payroll journal against.")
    return branch


def create_payroll_run(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, period_start: date, period_end: date, period_label: str) -> PayrollRun:
    existing = db.execute(
        select(PayrollRun).where(PayrollRun.tenant_id == tenant_id, PayrollRun.company_id == company_id, PayrollRun.period_start == period_start, PayrollRun.period_end == period_end)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    run = PayrollRun(tenant_id=tenant_id, company_id=company_id, period_start=period_start, period_end=period_end, period_label=period_label)
    db.add(run)
    db.flush()
    return run


def _current_salary_assignment(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, as_of: date) -> EmployeeSalaryAssignment | None:
    return db.execute(
        select(EmployeeSalaryAssignment).where(
            EmployeeSalaryAssignment.tenant_id == tenant_id, EmployeeSalaryAssignment.employee_id == employee_id,
            EmployeeSalaryAssignment.effective_date <= as_of,
            (EmployeeSalaryAssignment.end_date.is_(None)) | (EmployeeSalaryAssignment.end_date >= as_of),
        ).order_by(EmployeeSalaryAssignment.effective_date.desc())
    ).scalars().first()


def _working_days(period_start: date, period_end: date) -> Decimal:
    """Calendar days in the period minus Sundays -- a simplification
    (spec sec56-57 leave the exact weekly-off/late-deduction policy
    tenant-configurable; this pass assumes a single default weekly off
    rather than a per-company work-week setting, documented in
    ADR-015 as deferred)."""
    days = 0
    current = period_start
    while current <= period_end:
        if current.weekday() != 6:  # Sunday
            days += 1
        current += timedelta(days=1)
    return Decimal(days)


def _attendance_present_days(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, period_start: date, period_end: date) -> Decimal:
    records = db.execute(
        select(AttendanceRecord.status).where(
            AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.attendance_date >= period_start, AttendanceRecord.attendance_date <= period_end,
        )
    ).scalars().all()
    full = sum(1 for s in records if s in ("present", "late", "overtime"))
    half = sum(1 for s in records if s == "half_day")
    return Decimal(full) + Decimal(half) * Decimal("0.5")


def _paid_leave_days(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, period_start: date, period_end: date) -> Decimal:
    requests = db.execute(
        select(LeaveRequest, LeaveType.is_paid).join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id).where(
            LeaveRequest.tenant_id == tenant_id, LeaveRequest.employee_id == employee_id, LeaveRequest.status == "approved",
            LeaveRequest.start_date <= period_end, LeaveRequest.end_date >= period_start,
        )
    ).all()
    return sum((r.days for r, is_paid in requests if is_paid), Decimal("0"))


def _advance_deduction_candidates(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID) -> list[tuple[EmployeeAdvance, Decimal]]:
    """Computed, not yet applied -- the caller caps these against the
    employee's actual gross_earnings before touching
    EmployeeAdvance.outstanding_amount (see the net-pay-floor fix in
    calculate_payroll_run's docstring note below)."""
    advances = db.execute(
        select(EmployeeAdvance).where(
            EmployeeAdvance.tenant_id == tenant_id, EmployeeAdvance.employee_id == employee_id,
            EmployeeAdvance.status == "paid", EmployeeAdvance.outstanding_amount > 0,
        )
    ).scalars().all()
    return [(a, min(a.monthly_deduction_amount, a.outstanding_amount)) for a in advances if min(a.monthly_deduction_amount, a.outstanding_amount) > 0]


def calculate_payroll_run(db: Session, *, tenant_id: uuid.UUID, payroll_run_id: uuid.UUID) -> PayrollRun:
    run = db.get(PayrollRun, payroll_run_id)
    if run is None or run.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payroll run not found.", status_code=404)
    if run.status in NON_RECALCULABLE_STATUSES:
        raise AppError(ErrorCode.CONFLICT, f"Cannot recalculate a payroll run that is {run.status}.", status_code=409)

    ensure_default_salary_components(db, tenant_id=tenant_id, company_id=run.company_id)
    components = db.execute(select(SalaryComponent).where(SalaryComponent.tenant_id == tenant_id, SalaryComponent.company_id == run.company_id, SalaryComponent.is_active == True)).scalars().all()  # noqa: E712

    employees = db.execute(
        select(Employee).where(Employee.tenant_id == tenant_id, Employee.company_id == run.company_id, Employee.status.in_(ACTIVE_PAYROLL_STATUSES))
    ).scalars().all()

    # A recalculation can follow a mid-cycle status change (e.g. an
    # employee resigns after a first calculate) -- drop any item left
    # over from a run where that employee was still active, so a
    # reviewer never sees a stale exception for someone no longer part
    # of this run at all.
    active_employee_ids = {e.id for e in employees}
    stale_items = db.execute(
        select(PayrollItem).where(PayrollItem.tenant_id == tenant_id, PayrollItem.payroll_run_id == run.id, PayrollItem.employee_id.notin_(active_employee_ids))
    ).scalars().all()
    for stale in stale_items:
        db.delete(stale)
    db.flush()

    working_days = _working_days(run.period_start, run.period_end)
    total_gross = total_deductions = total_net = Decimal("0")

    for employee in employees:
        assignment = _current_salary_assignment(db, tenant_id=tenant_id, employee_id=employee.id, as_of=run.period_end)
        exceptions = []
        if not employee.bank_account_number or not employee.bank_ifsc:
            exceptions.append({"type": "missing_bank_details", "blocking": True})
        if assignment is None:
            exceptions.append({"type": "missing_salary_structure", "blocking": True})

        present_days = _attendance_present_days(db, tenant_id=tenant_id, employee_id=employee.id, period_start=run.period_start, period_end=run.period_end)
        paid_leave_days = _paid_leave_days(db, tenant_id=tenant_id, employee_id=employee.id, period_start=run.period_start, period_end=run.period_end)
        lop_days = max(Decimal("0"), working_days - present_days - paid_leave_days)
        pay_ratio = ((working_days - lop_days) / working_days) if working_days > 0 else Decimal("1")

        earnings: list[dict] = []
        deductions: list[dict] = []
        gross_earnings = Decimal("0")
        overtime_hours = Decimal(sum(
            r for r in db.execute(
                select(AttendanceRecord.overtime_minutes).where(
                    AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == employee.id,
                    AttendanceRecord.attendance_date >= run.period_start, AttendanceRecord.attendance_date <= run.period_end,
                )
            ).scalars().all()
        )) / Decimal("60")

        if assignment is not None:
            basic_prorated = (assignment.basic * pay_ratio).quantize(TWO_PLACES)
            earnings.append({"code": "BASIC", "name": "Basic", "amount": str(basic_prorated)})

            for component in components:
                if component.component_type != "earning":
                    continue
                override = assignment.component_overrides.get(component.code)
                if component.calculation_type == "percentage":
                    base = assignment.basic if component.percentage_basis == "basic" else assignment.monthly_gross
                    pct = Decimal(str(override)) if override is not None else (component.default_percentage or Decimal("0"))
                    amount = (base * pct / 100 * pay_ratio).quantize(TWO_PLACES)
                else:
                    amount = ((Decimal(str(override)) if override is not None else (component.default_amount or Decimal("0"))) * pay_ratio).quantize(TWO_PLACES)
                earnings.append({"code": component.code, "name": component.name, "amount": str(amount)})

            if overtime_hours > 0 and assignment.overtime_hourly_rate:
                ot_amount = (overtime_hours * assignment.overtime_hourly_rate).quantize(TWO_PLACES)
                earnings.append({"code": "OVERTIME", "name": "Overtime", "amount": str(ot_amount)})

            gross_earnings = sum((Decimal(e["amount"]) for e in earnings), Decimal("0"))

            for component in components:
                if component.component_type != "deduction":
                    continue
                override = assignment.component_overrides.get(component.code)
                if component.calculation_type == "percentage":
                    base = assignment.basic if component.percentage_basis == "basic" else assignment.monthly_gross
                    pct = Decimal(str(override)) if override is not None else (component.default_percentage or Decimal("0"))
                    amount = (base * pct / 100 * pay_ratio).quantize(TWO_PLACES)
                else:
                    amount = (Decimal(str(override)) if override is not None else (component.default_amount or Decimal("0"))).quantize(TWO_PLACES)
                deductions.append({"code": component.code, "name": component.name, "amount": str(amount)})

            # spec sec109: never let payroll math silently produce a
            # negative payslip. Statutory deductions (PF/PT, above) are
            # computed first and are already proportional to pay_ratio
            # (PF) or a small flat amount (PT); advance repayment is the
            # one deferrable deduction, so it's the one reduced -- fully
            # or partially -- if it would push net pay below zero. This
            # was a real bug: an employee with zero attendance in a
            # period (e.g. joined mid-cycle, or on unpaid leave the
            # whole month) still had their full advance instalment and
            # PT deducted against ~0 gross, producing a nonsensical
            # negative net_pay -- caught by actually calculating a real
            # payroll run, not by inspection.
            statutory_total = sum((Decimal(d["amount"]) for d in deductions), Decimal("0"))
            advance_headroom = max(Decimal("0"), gross_earnings - statutory_total)
            for advance, desired in _advance_deduction_candidates(db, tenant_id=tenant_id, employee_id=employee.id):
                applied = min(desired, advance_headroom).quantize(TWO_PLACES)
                advance_headroom -= applied
                if applied > 0:
                    advance.outstanding_amount -= applied
                    deductions.append({"code": "ADVANCE", "name": "Advance repayment", "amount": str(applied)})
                if applied < desired:
                    exceptions.append({"type": "advance_deduction_deferred", "blocking": False, "advance_id": str(advance.id), "deferred_amount": str((desired - applied).quantize(TWO_PLACES))})

        # total_deductions reports the real, full breakdown sum (never
        # silently clamped -- a payslip where the line items don't add
        # up to the printed total would be its own bug); net_pay is
        # floored at 0 instead of going negative when statutory
        # deductions alone (advance was already capped above) exceed
        # what was actually earned this period.
        deduction_total = sum((Decimal(d["amount"]) for d in deductions), Decimal("0"))
        if deduction_total > gross_earnings:
            exceptions.append({"type": "deductions_exceed_earnings", "blocking": False, "shortfall": str((deduction_total - gross_earnings).quantize(TWO_PLACES))})
        net_pay = max(Decimal("0"), gross_earnings - deduction_total)

        item = db.execute(
            select(PayrollItem).where(PayrollItem.tenant_id == tenant_id, PayrollItem.payroll_run_id == run.id, PayrollItem.employee_id == employee.id)
        ).scalar_one_or_none()
        if item is None:
            item = PayrollItem(tenant_id=tenant_id, payroll_run_id=run.id, employee_id=employee.id)
            db.add(item)

        item.working_days = working_days
        item.present_days = present_days
        item.leave_days = paid_leave_days
        item.lop_days = lop_days
        item.overtime_hours = overtime_hours
        item.gross_earnings = gross_earnings
        item.total_deductions = deduction_total
        item.net_pay = net_pay
        item.earnings_breakdown = earnings
        item.deductions_breakdown = deductions
        item.exceptions = exceptions
        db.flush()

        total_gross += gross_earnings
        total_deductions += deduction_total
        total_net += net_pay

    run.total_gross = total_gross
    run.total_deductions = total_deductions
    run.total_net = total_net
    run.total_employer_cost = total_gross  # employer statutory contributions (employer PF share, etc.) are a real, deferred follow-up -- see ADR-015
    run.status = "calculated"
    run.calculated_at = datetime.now(timezone.utc)
    db.flush()

    fire_trigger(db, tenant_id=tenant_id, trigger_type="payroll_generated", title="Payroll calculated", message=f"{run.period_label}: {len(employees)} employees, net pay ₹{total_net:.2f}.")
    return run


def approve_payroll_run(db: Session, *, tenant_id: uuid.UUID, payroll_run_id: uuid.UUID, approved_by_user_id: uuid.UUID) -> PayrollRun:
    run = db.get(PayrollRun, payroll_run_id)
    if run is None or run.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payroll run not found.", status_code=404)
    if run.status != "calculated":
        raise AppError(ErrorCode.CONFLICT, "Only a calculated payroll run can be approved.", status_code=409)

    items = db.execute(select(PayrollItem).where(PayrollItem.tenant_id == tenant_id, PayrollItem.payroll_run_id == run.id)).scalars().all()
    blocking = [i for i in items if any(e.get("blocking") for e in i.exceptions)]
    if blocking:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"{len(blocking)} employee(s) have blocking exceptions (missing bank details or salary structure). Fix these before approving.",
            details={"employee_ids": [str(i.employee_id) for i in blocking]},
        )

    run.status = "approved"
    run.approved_by_user_id = approved_by_user_id
    run.approved_at = datetime.now(timezone.utc)
    db.flush()
    return run


def _post_payroll_expense_journal(db: Session, *, tenant_id: uuid.UUID, run: PayrollRun) -> None:
    """Dr Salary Expense (per employee, cost-centered by department) ==
    Cr Payroll Payable (net pay owed) + Cr Employee Advances (advance
    repayment actually reduces that asset, not a generic payable --
    caught reviewing this before it shipped: crediting Payroll Payable
    for the advance portion would have been a real double-count, since
    the advance was already an asset when it was paid out) + Cr
    Payroll Payable again for any other statutory deduction (PF/PT/...
    -- a real simplification: a production system would use distinct
    PF Payable/PT Payable/TDS Payable liability accounts per component,
    not one shared bucket; see ADR-015's deferred list). Every total
    here is accumulated line-by-line from what was actually posted,
    not from the run's summary totals, so a partial skip (net_pay <= 0)
    can never leave debits and credits out of balance.
    """
    salary_expense = get_account(db, tenant_id=tenant_id, company_id=run.company_id, code="5100-SALARY")
    payroll_payable = get_account(db, tenant_id=tenant_id, company_id=run.company_id, code="2200-PAYROLL-PAYABLE")
    employee_advances = get_account(db, tenant_id=tenant_id, company_id=run.company_id, code="1400-EMP-ADVANCES")

    entry = JournalEntry(tenant_id=tenant_id, company_id=run.company_id, branch_id=_main_branch(db, tenant_id=tenant_id, company_id=run.company_id).id, entry_date=run.period_end, document_type="payroll_run", document_id=run.id, narration=f"Payroll {run.period_label}")
    db.add(entry)
    db.flush()

    def line(account_id: uuid.UUID, *, debit: Decimal = Decimal("0"), credit: Decimal = Decimal("0"), party_id: uuid.UUID | None = None, cost_center_id: uuid.UUID | None = None) -> None:
        if debit == 0 and credit == 0:
            return
        db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=account_id, debit=debit, credit=credit, party_type="employee" if party_id else None, party_id=party_id, cost_center_id=cost_center_id))

    net_payable_total = Decimal("0")
    advance_total = Decimal("0")
    other_deduction_total = Decimal("0")

    items = db.execute(select(PayrollItem).where(PayrollItem.tenant_id == tenant_id, PayrollItem.payroll_run_id == run.id)).scalars().all()
    for item in items:
        if item.gross_earnings <= 0:
            continue
        employee = db.get(Employee, item.employee_id)
        cost_center_id = None
        if employee and employee.department_id:
            department = db.get(Department, employee.department_id)
            cost_center_id = department.cost_center_id if department else None
        line(salary_expense.id, debit=item.gross_earnings, party_id=item.employee_id, cost_center_id=cost_center_id)

        # Derived from gross_earnings - net_pay, NOT item.total_deductions
        # directly -- the two can differ (services/payroll.py's
        # calculate_payroll_run floors net_pay at 0 rather than go
        # negative when deductions exceed a low/zero prorated gross,
        # e.g. an employee with no attendance at all this period). Using
        # total_deductions here would post more credit than the gross
        # debit covers -- an unbalanced journal entry. This formulation
        # is balanced by construction for every item, always.
        postable_deductions = item.gross_earnings - item.net_pay
        item_advance_requested = sum((Decimal(d["amount"]) for d in item.deductions_breakdown if d["code"] == "ADVANCE"), Decimal("0"))
        item_advance = min(item_advance_requested, postable_deductions)
        advance_total += item_advance
        other_deduction_total += postable_deductions - item_advance
        net_payable_total += item.net_pay

    line(payroll_payable.id, credit=net_payable_total)
    line(employee_advances.id, credit=advance_total)
    line(payroll_payable.id, credit=other_deduction_total)
    db.flush()


def lock_payroll_run(db: Session, *, tenant_id: uuid.UUID, payroll_run_id: uuid.UUID) -> PayrollRun:
    run = db.get(PayrollRun, payroll_run_id)
    if run is None or run.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payroll run not found.", status_code=404)
    if run.status != "approved":
        raise AppError(ErrorCode.CONFLICT, "Only an approved payroll run can be locked.", status_code=409)

    ensure_default_accounts(db, tenant_id=tenant_id, company_id=run.company_id)
    _post_payroll_expense_journal(db, tenant_id=tenant_id, run=run)

    run.status = "locked"
    run.locked_at = datetime.now(timezone.utc)
    db.flush()

    fire_trigger(db, tenant_id=tenant_id, trigger_type="payslip_available", title="Payslips available", message=f"Payslips for {run.period_label} are now available.")
    return run


def pay_payroll_run(db: Session, *, tenant_id: uuid.UUID, payroll_run_id: uuid.UUID) -> PayrollRun:
    """spec sec50: bank export/payment-provider integration is a real,
    deferred follow-up (no bank/payroll-payment-provider credentials
    exist in this environment, same "no fake credentials" reasoning as
    ADR-007/ADR-014) -- this marks the run paid and posts the Payroll
    Payable -> Bank journal leg, which is the part that's actually
    within this codebase's own accounting, without claiming money
    actually left a real bank account."""
    run = db.get(PayrollRun, payroll_run_id)
    if run is None or run.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Payroll run not found.", status_code=404)
    if run.status != "locked":
        raise AppError(ErrorCode.CONFLICT, "Only a locked payroll run can be paid.", status_code=409)

    payroll_payable = get_account(db, tenant_id=tenant_id, company_id=run.company_id, code="2200-PAYROLL-PAYABLE")
    bank = get_account(db, tenant_id=tenant_id, company_id=run.company_id, code="1010-BANK")

    # Read back what was actually credited to Payroll Payable when the
    # run was locked (net pay + non-advance deductions -- the advance
    # portion went to Employee Advances instead, see
    # _post_payroll_expense_journal) rather than recomputing from
    # run.total_net/total_deductions, which would double-count the
    # advance amount that never touched this liability account.
    locking_entry = db.execute(
        select(JournalEntry).where(JournalEntry.tenant_id == tenant_id, JournalEntry.document_type == "payroll_run", JournalEntry.document_id == run.id)
    ).scalar_one_or_none()
    if locking_entry is None:
        raise AppError(ErrorCode.INTERNAL_ERROR, "Payroll run has no expense journal to settle.", status_code=500)
    payable_credit_lines = db.execute(
        select(JournalLine.credit).where(JournalLine.tenant_id == tenant_id, JournalLine.journal_entry_id == locking_entry.id, JournalLine.account_id == payroll_payable.id)
    ).scalars().all()
    total_payable = sum(payable_credit_lines, Decimal("0"))

    entry = JournalEntry(tenant_id=tenant_id, company_id=run.company_id, branch_id=_main_branch(db, tenant_id=tenant_id, company_id=run.company_id).id, entry_date=datetime.now(timezone.utc).date(), document_type="payroll_payment", document_id=run.id, narration=f"Payroll payment {run.period_label}")
    db.add(entry)
    db.flush()
    db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=payroll_payable.id, debit=total_payable, credit=Decimal("0")))
    db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=bank.id, debit=Decimal("0"), credit=total_payable))
    db.flush()

    run.status = "paid"
    run.paid_at = datetime.now(timezone.utc)
    db.flush()
    return run
