import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class ApprovalRule(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §63: configurable, table-driven -- not hardcoded per
    scenario. Only "credit_limit_exceeded" has a real call site today
    (see ADR-009); the table shape supports more without a schema change.
    """

    __tablename__ = "approval_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "credit_limit_exceeded" | ...
    threshold_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    required_role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ApprovalRequest(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "approval_requests"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_rules.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "quotation" | ...
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|approved|rejected
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
