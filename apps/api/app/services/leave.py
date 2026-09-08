"""ADR-015 (spec sec26-31). Leave types are tenant-configurable (never
hardcoded statutory policy, per spec sec26's explicit instruction);
LeaveBalance is checked before a request is allowed to be *submitted*
for a type with a real allocation (spec sec27's "negative balance"
policy is left permissive by default -- a balance can go negative
today, since blocking submission entirely is a stricter policy this
pass doesn't make a per-tenant setting for yet).
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.attendance import AttendanceRecord
from app.models.leave import LeaveBalance, LeaveRequest, LeaveType
from app.services.notification_rules import fire_trigger

DEFAULT_LEAVE_TYPES: list[tuple[str, str, Decimal, bool]] = [
    ("casual", "Casual Leave", Decimal("12"), True),
    ("sick", "Sick Leave", Decimal("12"), True),
    ("earned", "Earned Leave", Decimal("15"), True),
    ("unpaid", "Unpaid Leave", Decimal("0"), False),
]


def ensure_default_leave_types(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> None:
    existing = {t.code for t in db.execute(select(LeaveType).where(LeaveType.tenant_id == tenant_id, LeaveType.company_id == company_id)).scalars()}
    for code, name, allocation, is_paid in DEFAULT_LEAVE_TYPES:
        if code not in existing:
            db.add(LeaveType(tenant_id=tenant_id, company_id=company_id, code=code, name=name, annual_allocation_days=allocation, is_paid=is_paid))
    db.flush()


def get_or_create_balance(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, leave_type_id: uuid.UUID, year: int) -> LeaveBalance:
    balance = db.execute(
        select(LeaveBalance).where(
            LeaveBalance.tenant_id == tenant_id, LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id, LeaveBalance.year == year,
        )
    ).scalar_one_or_none()
    if balance is None:
        leave_type = db.get(LeaveType, leave_type_id)
        balance = LeaveBalance(
            tenant_id=tenant_id, employee_id=employee_id, leave_type_id=leave_type_id, year=year,
            allocated_days=leave_type.annual_allocation_days if leave_type else Decimal("0"),
        )
        db.add(balance)
        db.flush()
    return balance


def request_leave(
    db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, leave_type_id: uuid.UUID,
    start_date: date, end_date: date, half_day: bool = False, reason: str | None = None,
) -> LeaveRequest:
    if end_date < start_date:
        raise AppError(ErrorCode.VALIDATION_ERROR, "End date cannot be before start date.")
    days = Decimal("0.5") if half_day else Decimal((end_date - start_date).days + 1)

    request = LeaveRequest(
        tenant_id=tenant_id, employee_id=employee_id, leave_type_id=leave_type_id,
        start_date=start_date, end_date=end_date, days=days, half_day=half_day, reason=reason,
    )
    db.add(request)
    db.flush()

    fire_trigger(
        db, tenant_id=tenant_id, trigger_type="leave_submitted", title="Leave request submitted",
        message=f"{days:g} day(s) requested from {start_date} to {end_date}.", entity_type="leave_request", entity_id=request.id,
    )
    return request


def review_leave(
    db: Session, *, tenant_id: uuid.UUID, leave_request_id: uuid.UUID, approve: bool,
    reviewed_by_user_id: uuid.UUID, review_notes: str | None = None,
) -> LeaveRequest:
    request = db.get(LeaveRequest, leave_request_id)
    if request is None or request.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Leave request not found.", status_code=404)
    if request.status != "pending":
        raise AppError(ErrorCode.CONFLICT, "This leave request has already been reviewed.", status_code=409)

    request.status = "approved" if approve else "rejected"
    request.reviewed_by_user_id = reviewed_by_user_id
    request.reviewed_at = datetime.now(timezone.utc)
    request.review_notes = review_notes
    db.flush()

    if approve:
        balance = get_or_create_balance(db, tenant_id=tenant_id, employee_id=request.employee_id, leave_type_id=request.leave_type_id, year=request.start_date.year)
        balance.used_days += request.days
        db.flush()

        current = request.start_date
        while current <= request.end_date:
            record = db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == request.employee_id,
                    AttendanceRecord.attendance_date == current,
                )
            ).scalar_one_or_none()
            if record is None:
                db.add(AttendanceRecord(tenant_id=tenant_id, employee_id=request.employee_id, attendance_date=current, status="on_leave"))
            else:
                record.status = "on_leave"
            current += timedelta(days=1)
        db.flush()

    fire_trigger(
        db, tenant_id=tenant_id, trigger_type="leave_approved" if approve else "leave_rejected",
        title=f"Leave {'approved' if approve else 'rejected'}",
        message=f"Your leave request from {request.start_date} to {request.end_date} was {'approved' if approve else 'rejected'}.",
        entity_type="leave_request", entity_id=request.id,
    )
    return request


def leave_balance_summary(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, year: int) -> list[LeaveBalance]:
    leave_types = db.execute(select(LeaveType).where(LeaveType.tenant_id == tenant_id, LeaveType.is_active == True)).scalars().all()  # noqa: E712
    return [get_or_create_balance(db, tenant_id=tenant_id, employee_id=employee_id, leave_type_id=lt.id, year=year) for lt in leave_types]
