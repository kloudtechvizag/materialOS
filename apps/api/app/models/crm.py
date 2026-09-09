import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)


class Lead(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Pre-Customer pipeline stage (Business Graph: Lead -> Customer ->
    Quotation -> ...). Deliberately lighter than Customer -- a lead can
    exist with just a name and a phone number, before anyone decides
    which branch handles it or whether it's even a real prospect.
    Converting creates a real Customer row (services/crm.py) rather
    than the Lead itself gradually turning into one, so every Customer
    in the system still means the same thing everywhere else it's
    referenced (credit, invoices, portal access, ...).
    """

    __tablename__ = "leads"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # free text, e.g. "Referral", "Website", "Field visit"
    # new -> contacted -> qualified -> proposal -> won | lost
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    estimated_value: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    converted_customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
