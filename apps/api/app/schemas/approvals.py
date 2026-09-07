import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ApprovalRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    trigger_type: str
    threshold_value: Decimal | None
    required_role: str
    is_active: bool

    class Config:
        from_attributes = True


class ApprovalRequestOut(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    document_type: str
    document_id: uuid.UUID
    requested_by_user_id: uuid.UUID
    status: str
    reason: str | None
    decided_by_user_id: uuid.UUID | None
    decided_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalDecisionRequest(BaseModel):
    reason: str | None = None
