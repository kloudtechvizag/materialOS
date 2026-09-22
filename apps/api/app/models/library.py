"""Library (Phase 6, spec sec19): book catalog, physical copies, and
circulation (issue/return with overdue fines). Deliberately NOT the
core Item/StockBalance catalog -- a library book has no GST/pricing
need (unlike Fee Management's FeeHead, which genuinely needed
Invoice-grade billing) and its own fields (author/ISBN/publisher)
would pollute the universal Item master for every other industry the
same way bolting exam/attendance fields onto it would have. Also NOT
SerialUnit (models/serial.py) -- its status vocabulary and FKs
(purchase_bill_item_id, invoice_item_id, warranty_expiry) are
retail/warranty-specific, not circulation-specific; forcing "issued"
through a field shaped for "sold" would be the same kind of mismatch
Transport (ADR-034) already rejected Trip for.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

BOOK_COPY_STATUSES = ["available", "issued", "lost", "damaged", "withdrawn"]
BOOK_ISSUE_STATUSES = ["issued", "returned", "lost"]


class Book(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "books"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)


class BookCopy(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One physical, individually-trackable copy -- a library's real
    unit of circulation is the copy, not the title (two copies of the
    same book can have different availability at the same time)."""

    __tablename__ = "book_copies"
    __table_args__ = (UniqueConstraint("tenant_id", "accession_number", name="uq_book_copies_accession"),)

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The physical copy's home campus (ADR-038) -- deliberately NOT on
    # Book itself: a title's catalog entry is shared across campuses,
    # but each individual copy sits on one campus's shelves and can't
    # be issued to a student at a different campus.
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    accession_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")


class BookIssue(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One circulation transaction. "overdue" is deliberately not a
    stored status -- it's derived (returned_date is null and due_date
    has passed), the same "never store what's cheaply derivable"
    discipline the rest of this codebase already follows (e.g.
    ReportCard percentages, Homework roster status)."""

    __tablename__ = "book_issues"

    book_copy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("book_copies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    issued_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="issued")
    # Tracked directly on the issue, not routed through Invoice/Receipt
    # (unlike Fee Management, ADR-031) -- a library fine is a real
    # amount but this pass keeps it a simple staff-collected figure,
    # not full accounting integration; named as a deliberate scope
    # limit, not an oversight.
    fine_amount: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    fine_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
