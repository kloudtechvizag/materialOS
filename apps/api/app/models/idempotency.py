from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class IdempotencyKey(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B8: client-supplied Idempotency-Key + stored response, replayed
    verbatim for `idempotency_key_ttl_hours` on retry.
    """

    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("tenant_id", "key", name="uq_idempotency_tenant_key"),)

    key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_path: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
