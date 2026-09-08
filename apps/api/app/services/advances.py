"""ADR-015 (spec sec40). Employee request -> manager/finance approval
-> paid -> payroll deduction. This pass collapses "manager approval"
and "finance approval" (spec's two-step workflow) into one approval
step gated by a single permission (advances.approve) -- a real two-
stage approval chain would reuse ApprovalRule/ApprovalRequest
(app/models/approvals.py) the way credit-limit approval already does,
which is a reasonable follow-up, not built this pass (see ADR-015).
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.payroll import EmployeeAdvance
from app.services.notification_rules import fire_trigger


def request_advance(db: Session, *, tenant_id: uuid.UUID, employee_id: uuid.UUID, amount: Decimal, monthly_deduction_amount: Decimal, reason: str | None = None) -> EmployeeAdvance:
    if amount <= 0:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Advance amount must be positive.")
    advance = EmployeeAdvance(
        tenant_id=tenant_id, employee_id=employee_id, amount=amount, reason=reason,
        monthly_deduction_amount=monthly_deduction_amount, outstanding_amount=amount,
    )
    db.add(advance)
    db.flush()
    return advance


def approve_advance(db: Session, *, tenant_id: uuid.UUID, advance_id: uuid.UUID, approved_by_user_id: uuid.UUID) -> EmployeeAdvance:
    advance = db.get(EmployeeAdvance, advance_id)
    if advance is None or advance.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Advance not found.", status_code=404)
    if advance.status != "pending":
        raise AppError(ErrorCode.CONFLICT, "This advance has already been reviewed.", status_code=409)

    advance.status = "approved"
    advance.approved_by_user_id = approved_by_user_id
    advance.approved_at = datetime.now(timezone.utc)
    db.flush()

    fire_trigger(db, tenant_id=tenant_id, trigger_type="advance_approved", title="Advance approved", message=f"Advance of ₹{advance.amount} approved.", entity_type="employee_advance", entity_id=advance.id)
    return advance


def mark_advance_paid(db: Session, *, tenant_id: uuid.UUID, advance_id: uuid.UUID) -> EmployeeAdvance:
    """Marks the advance disbursed and eligible for payroll deduction
    (services/payroll.py::_apply_advance_deductions). Does not itself
    post an accounting entry for the cash disbursement -- that's a real,
    separate cash-payment recording this pass doesn't wire up (paying
    an advance out is not meaningfully different from any other cash
    disbursement the accounting module would already handle)."""
    advance = db.get(EmployeeAdvance, advance_id)
    if advance is None or advance.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Advance not found.", status_code=404)
    if advance.status != "approved":
        raise AppError(ErrorCode.CONFLICT, "Only an approved advance can be marked paid.", status_code=409)

    advance.status = "paid"
    advance.paid_at = datetime.now(timezone.utc)
    db.flush()
    return advance
