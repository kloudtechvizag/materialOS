import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class FinancialYear(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "financial_years"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_financial_years_company_code"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026-27"
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class DocNumberCounter(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B7: gapless, concurrency-safe numbering. Incremented only via
    SELECT ... FOR UPDATE in services.numbering -- never via a bare
    UPDATE ... SET current_number = current_number + 1 outside that lock,
    and never via a Postgres SEQUENCE (sequences gap on rollback).
    """

    __tablename__ = "doc_number_counters"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "branch_id", "doc_type", "financial_year_id",
            name="uq_doc_counters_scope",
        ),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    financial_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("financial_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)  # INV, SO, PO, QT, DC, PMT ...
    prefix: Mapped[str] = mapped_column(String(20), nullable=False)
    padding: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    current_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
