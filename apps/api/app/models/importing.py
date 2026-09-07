import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

IMPORT_STATUSES = [
    "uploaded",
    "format_detected",
    "mapped",
    "validated",
    "previewed",
    "committed",
    "failed",
]

SOURCE_TYPES = ["tally_xml", "busy_csv", "marg_csv"]
ROW_TYPES = ["customer", "supplier", "item", "opening_balance"]
ROW_ACTIONS = ["create", "skip", "duplicate"]


class ImportBatch(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Slice 0 acceptance test hangs off this table: a dealer's Tally
    company must load in under 10 minutes with outstanding matching to
    the rupee. See MaterialOS_Master_Brief_v2.md Slice 0.
    """

    __tablename__ = "import_batches"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="uploaded")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    column_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ImportBatchRow(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "import_batch_rows"

    import_batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_type: Mapped[str] = mapped_column(String(20), nullable=False)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    mapped_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    validation_errors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False, default="create")
