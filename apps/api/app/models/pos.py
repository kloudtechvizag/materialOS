import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)


class WalkInSale(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Retail profile counter sale (Master Brief Part C names WalkInSale
    as a first-class entity). This is a thin header around a real
    Invoice -- line items, tax, and the journal all live on
    Invoice/InvoiceItem exactly as they do for the quotation-driven
    flow (see services/pos.py), so POS inherits B3/B5/B6 for free
    instead of a second, parallel posting path. The fields here are
    purely POS-specific: how the till was actually settled.
    """

    __tablename__ = "walk_in_sales"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Sum of these three must equal Invoice.total exactly (see
    # services/pos.py) -- a walk-in sale is always settled in full at
    # checkout, never left partially paid.
    cash_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    upi_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    card_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    # Physical cash handling only -- what the till received for the cash
    # portion, so change can be calculated; not itself a ledger amount.
    tendered_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    change_due: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
