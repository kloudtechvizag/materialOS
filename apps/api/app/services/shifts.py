"""ADR-015 (spec sec12-14). Shift CRUD plus effective-dated assignment
-- see models/hr.py::ShiftAssignment's docstring for why this isn't a
weekly roster grid.
"""
import uuid
from datetime import date, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr import Employee, Shift, ShiftAssignment
from app.services.hr import log_history


def ensure_default_shift(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> Shift:
    existing = db.execute(select(Shift).where(Shift.tenant_id == tenant_id, Shift.company_id == company_id)).scalars().first()
    if existing:
        return existing
    shift = Shift(
        tenant_id=tenant_id, company_id=company_id, name="General Shift",
        start_time=time(9, 0), end_time=time(18, 0), break_minutes=60, grace_minutes=10,
    )
    db.add(shift)
    db.flush()
    return shift


def assign_shift(
    db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, shift_id: uuid.UUID,
    effective_date: date, updated_by_user_id: uuid.UUID | None = None,
) -> ShiftAssignment:
    # Close out any currently-open assignment as of the day before this one starts.
    open_assignment = db.execute(
        select(ShiftAssignment).where(
            ShiftAssignment.tenant_id == tenant_id, ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.end_date.is_(None),
        )
    ).scalar_one_or_none()
    if open_assignment is not None:
        open_assignment.end_date = effective_date - timedelta(days=1)

    assignment = ShiftAssignment(tenant_id=tenant_id, employee_id=employee_id, shift_id=shift_id, effective_date=effective_date)
    db.add(assignment)
    db.flush()

    employee = db.get(Employee, employee_id)
    if employee is not None and employee.shift_id != shift_id:
        old_shift_id = employee.shift_id
        employee.shift_id = shift_id
        log_history(
            db, tenant_id=tenant_id, employee_id=employee_id, event_type="shift_changed",
            description="Shift changed.", old_value={"shift_id": str(old_shift_id) if old_shift_id else None},
            new_value={"shift_id": str(shift_id)}, effective_date=effective_date, created_by_user_id=updated_by_user_id,
        )
    db.flush()
    return assignment


def get_current_shift(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, as_of: date | None = None) -> Shift | None:
    as_of = as_of or date.today()
    employee = db.get(Employee, employee_id)
    if employee is None or employee.shift_id is None:
        return None
    return db.get(Shift, employee.shift_id)
