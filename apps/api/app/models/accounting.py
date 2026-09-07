import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)

ACCOUNT_TYPES = ("asset", "liability", "income", "expense")


class Account(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Minimal chart of accounts -- enough for Invoice/Receipt to post a
    balanced journal (B5, B6). Full CoA management, cost centres, and
    financial statements are Slice 4.
    """

    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_accounts_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_system: Mapped[bool] = mapped_column(nullable=False, default=True)


class JournalEntry(Base, UUIDPk, TenantMixin, TimestampMixin):
    """B5: sum(debits) == sum(credits), enforced by a deferred constraint
    trigger (see the migration), not by application code alone. B6:
    created in the same DB transaction as the document it belongs to.
    """

    __tablename__ = "journal_entries"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "invoice" | "receipt" | ...
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    narration: Mapped[str | None] = mapped_column(String(255), nullable=True)


class JournalLine(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "journal_lines"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    debit: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    credit: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    party_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "customer" | "supplier"
    party_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
