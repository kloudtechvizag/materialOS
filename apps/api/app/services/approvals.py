"""dev.md §63: configurable, table-driven approval workflow. See
ADR-009 for why only credit_limit_exceeded has a real call site.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import session_scope, set_session_context
from app.errors import AppError, ErrorCode
from app.models.approvals import ApprovalRequest, ApprovalRule
from app.services.credit import check_credit
from app.services.notifications import notify

DEFAULT_RULES = [
    ("Credit limit override", "credit_limit_exceeded", None, "finance_manager"),
]


def ensure_default_approval_rules(db: Session, *, tenant_id: uuid.UUID) -> None:
    existing_types = {r.trigger_type for r in db.execute(select(ApprovalRule).where(ApprovalRule.tenant_id == tenant_id)).scalars()}
    for name, trigger_type, threshold, role in DEFAULT_RULES:
        if trigger_type not in existing_types:
            db.add(ApprovalRule(tenant_id=tenant_id, name=name, trigger_type=trigger_type, threshold_value=threshold, required_role=role))
    db.flush()


def find_approved_request(db: Session, *, document_type: str, document_id: uuid.UUID, trigger_type: str) -> ApprovalRequest | None:
    return db.execute(
        select(ApprovalRequest)
        .join(ApprovalRule, ApprovalRule.id == ApprovalRequest.rule_id)
        .where(
            ApprovalRequest.document_type == document_type, ApprovalRequest.document_id == document_id,
            ApprovalRule.trigger_type == trigger_type, ApprovalRequest.status == "approved",
        )
    ).scalar_one_or_none()


def request_approval(
    db: Session, *, tenant_id: uuid.UUID, trigger_type: str, document_type: str, document_id: uuid.UUID,
    requested_by_user_id: uuid.UUID, reason: str,
) -> ApprovalRequest:
    """Called from inside a request that is about to fail (the caller is
    blocked and is about to raise). deps.get_db_tenant rolls back its whole
    session on any exception (B6) -- if we wrote the ApprovalRequest through
    that same session it would vanish along with everything else. ADR-009
    requires the pending request to survive, so it's written and committed
    through its own short-lived session instead.
    """
    rule = db.execute(
        select(ApprovalRule).where(ApprovalRule.tenant_id == tenant_id, ApprovalRule.trigger_type == trigger_type, ApprovalRule.is_active.is_(True))
    ).scalar_one_or_none()
    if rule is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"No active approval rule for {trigger_type}.")

    existing = db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.document_type == document_type, ApprovalRequest.document_id == document_id,
            ApprovalRequest.rule_id == rule.id, ApprovalRequest.status == "pending",
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    with session_scope() as side_db:
        set_session_context(side_db, tenant_id=str(tenant_id), user_id=None)
        request = ApprovalRequest(
            tenant_id=tenant_id, rule_id=rule.id, document_type=document_type, document_id=document_id,
            requested_by_user_id=requested_by_user_id, status="pending", reason=reason,
        )
        side_db.add(request)
        side_db.flush()
        notify(
            side_db, tenant_id=tenant_id, notification_type="approval_pending",
            title=f"Approval needed: {rule.name}", message=reason,
            entity_type=document_type, entity_id=document_id,
        )
    return request


def decide_request(db: Session, *, request_id: uuid.UUID, decided_by_user_id: uuid.UUID, approve: bool, reason: str | None = None) -> ApprovalRequest:
    request = db.get(ApprovalRequest, request_id)
    if request is None:
        raise AppError(ErrorCode.NOT_FOUND, "Approval request not found.", status_code=404)
    if request.status != "pending":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a pending approval request can be decided.")

    request.status = "approved" if approve else "rejected"
    request.decided_by_user_id = decided_by_user_id
    request.decided_at = datetime.now(timezone.utc)
    if reason:
        request.reason = f"{request.reason or ''} | Decision: {reason}".strip(" |")
    db.flush()
    return request


def check_credit_with_approval(
    db: Session, *, tenant_id: uuid.UUID, customer_id: uuid.UUID, additional_amount: Decimal,
    document_type: str, document_id: uuid.UUID, requested_by_user_id: uuid.UUID,
) -> None:
    """Wraps services/credit.check_credit (B25) with ADR-009's approval
    workflow: a block doesn't just raise -- it also opens a pending
    ApprovalRequest, and an already-approved request lets a retry through
    without re-running the credit check.
    """
    if find_approved_request(db, document_type=document_type, document_id=document_id, trigger_type="credit_limit_exceeded") is not None:
        return

    try:
        check_credit(db, customer_id, additional_amount)
    except AppError as exc:
        if exc.code != ErrorCode.CREDIT_LIMIT_EXCEEDED:
            raise
        request = request_approval(
            db, tenant_id=tenant_id, trigger_type="credit_limit_exceeded",
            document_type=document_type, document_id=document_id,
            requested_by_user_id=requested_by_user_id, reason=exc.message,
        )
        exc.details["approval_request_id"] = str(request.id)
        raise
