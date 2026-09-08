import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Backup(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A tenant-scoped logical backup (ADR-013) -- NOT a whole-database
    pg_dump. This platform is multi-tenant with every tenant's rows in
    the same Postgres database (B9, RLS-isolated); a raw pg_dump would
    contain every other tenant's data too, and a "restore my backup"
    button built on top of that would be a real tenant-isolation
    violation waiting to happen. Instead this dumps exactly this
    tenant's own rows (see services/backup.py::list_backupable_tables)
    -- the resulting file can never contain another tenant's data
    because RLS filters the SELECTs that produce it.
    """

    __tablename__ = "backups"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|running|completed|failed
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)  # sha256 hex of the decrypted JSON
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # encrypted, as-stored size
    table_counts: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # {table_name: row_count}
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    restored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    restored_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # no FK -- matches ApprovalRequest.requested_by_user_id precedent
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # None for scheduled/system-triggered backups
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
