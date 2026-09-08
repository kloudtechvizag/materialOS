"""ADR-015 (spec sec15-25). Clock-in/out, computing late/worked/
overtime minutes against the employee's current shift, missing-punch
detection, and correction requests.

`AttendanceDeviceProvider` (spec sec16, sec89) is a real adapter
*interface*, not a real device integration -- there is no hardware in
this environment to integrate against, same reasoning as ADR-012's
barcode-scanner note (a HID keyboard-wedge device needs no code at
all) and ADR-007's live-gateway refusal pattern. `ManualAttendanceProvider`
is the one real implementation (a manager or the employee's own web
clock-in/out, both go through `clock_in`/`clock_out` below); a future
biometric/QR device would implement the same interface and call the
same two functions -- the attendance engine itself is not coupled to
how the punch arrived.
"""
import uuid
from abc import ABC, abstractmethod
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.attendance import AttendanceCorrection, AttendanceRecord
from app.models.hr import Employee
from app.services.notification_rules import fire_trigger
from app.services.shifts import get_current_shift


class AttendanceDeviceProvider(ABC):
    @abstractmethod
    def punch(self, *, employee_id: uuid.UUID, at: datetime) -> str: ...  # returns "in" | "out"


class ManualAttendanceProvider(AttendanceDeviceProvider):
    """Web/manual punches -- the only provider actually wired up."""

    def punch(self, *, employee_id: uuid.UUID, at: datetime) -> str:
        return "manual"


def _get_or_create_today(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, attendance_date: date) -> AttendanceRecord:
    record = db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.attendance_date == attendance_date,
        )
    ).scalar_one_or_none()
    if record is None:
        record = AttendanceRecord(tenant_id=tenant_id, employee_id=employee_id, attendance_date=attendance_date, status="missing_punch")
        db.add(record)
        db.flush()
    return record


def clock_in(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, method: str = "web") -> AttendanceRecord:
    now = datetime.now(timezone.utc)
    record = _get_or_create_today(db, tenant_id=tenant_id, employee_id=employee_id, attendance_date=now.date())
    if record.clock_in_at is not None:
        raise AppError(ErrorCode.CONFLICT, "Already clocked in today.", status_code=409)

    record.clock_in_at = now
    record.method = method
    record.status = "present"

    shift = get_current_shift(db, tenant_id=tenant_id, employee_id=employee_id)
    if shift is not None:
        shift_start = datetime.combine(now.date(), shift.start_time, tzinfo=timezone.utc)
        late_minutes = max(0, int((now - shift_start).total_seconds() // 60) - shift.grace_minutes)
        if late_minutes > 0:
            record.late_minutes = late_minutes
            record.status = "late"

    db.flush()
    return record


def clock_out(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID) -> AttendanceRecord:
    now = datetime.now(timezone.utc)
    record = db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.attendance_date == now.date(),
        )
    ).scalar_one_or_none()
    if record is None or record.clock_in_at is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No clock-in found for today.")
    if record.clock_out_at is not None:
        raise AppError(ErrorCode.CONFLICT, "Already clocked out today.", status_code=409)

    record.clock_out_at = now
    worked_minutes = max(0, int((now - record.clock_in_at).total_seconds() // 60))

    shift = get_current_shift(db, tenant_id=tenant_id, employee_id=employee_id)
    if shift is not None:
        worked_minutes = max(0, worked_minutes - shift.break_minutes)
        shift_minutes = (
            (shift.end_time.hour * 60 + shift.end_time.minute) - (shift.start_time.hour * 60 + shift.start_time.minute) - shift.break_minutes
        )
        if shift_minutes > 0 and worked_minutes > shift_minutes:
            record.overtime_minutes = worked_minutes - shift_minutes
        if shift_minutes > 0 and worked_minutes < shift_minutes / 2:
            record.status = "half_day"

    record.worked_minutes = worked_minutes
    db.flush()
    return record


def request_correction(
    db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, attendance_date: date,
    requested_clock_in: datetime | None, requested_clock_out: datetime | None, reason: str,
) -> AttendanceCorrection:
    correction = AttendanceCorrection(
        tenant_id=tenant_id, employee_id=employee_id, attendance_date=attendance_date,
        requested_clock_in=requested_clock_in, requested_clock_out=requested_clock_out, reason=reason,
    )
    db.add(correction)
    db.flush()

    fire_trigger(
        db, tenant_id=tenant_id, trigger_type="attendance_correction_submitted", title="Attendance correction submitted",
        message=f"Correction requested for {attendance_date}.", entity_type="attendance_correction", entity_id=correction.id,
    )
    return correction


def review_correction(
    db: Session, *, tenant_id: uuid.UUID, correction_id: uuid.UUID, approve: bool,
    reviewed_by_user_id: uuid.UUID, review_notes: str | None = None,
) -> AttendanceCorrection:
    correction = db.get(AttendanceCorrection, correction_id)
    if correction is None or correction.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Correction request not found.", status_code=404)
    if correction.status != "pending":
        raise AppError(ErrorCode.CONFLICT, "This correction has already been reviewed.", status_code=409)

    correction.status = "approved" if approve else "rejected"
    correction.reviewed_by_user_id = reviewed_by_user_id
    correction.reviewed_at = datetime.now(timezone.utc)
    correction.review_notes = review_notes

    if approve:
        record = _get_or_create_today(db, tenant_id=tenant_id, employee_id=correction.employee_id, attendance_date=correction.attendance_date)
        if correction.requested_clock_in:
            record.clock_in_at = correction.requested_clock_in
        if correction.requested_clock_out:
            record.clock_out_at = correction.requested_clock_out
        if record.clock_in_at and record.clock_out_at:
            record.worked_minutes = max(0, int((record.clock_out_at - record.clock_in_at).total_seconds() // 60))
            record.status = "present"

    db.flush()
    return correction
