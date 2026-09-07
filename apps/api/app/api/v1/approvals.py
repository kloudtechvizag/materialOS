import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.approvals import ApprovalRequest
from app.schemas.approvals import ApprovalDecisionRequest, ApprovalRequestOut
from app.services.approvals import decide_request

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRequestOut])
def list_approval_requests(
    status: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("approvals.view")),
) -> list[ApprovalRequest]:
    stmt = select(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())
    if status:
        stmt = stmt.where(ApprovalRequest.status == status)
    return db.execute(stmt).scalars().all()


@router.post("/{request_id}/approve", response_model=ApprovalRequestOut)
def approve(
    request_id: uuid.UUID, payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db_tenant), user=Depends(require_permission("approvals.approve")),
) -> ApprovalRequest:
    return decide_request(db, request_id=request_id, decided_by_user_id=user.id, approve=True, reason=payload.reason)


@router.post("/{request_id}/reject", response_model=ApprovalRequestOut)
def reject(
    request_id: uuid.UUID, payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db_tenant), user=Depends(require_permission("approvals.approve")),
) -> ApprovalRequest:
    return decide_request(db, request_id=request_id, decided_by_user_id=user.id, approve=False, reason=payload.reason)
