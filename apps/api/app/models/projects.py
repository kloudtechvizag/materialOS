import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Project(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Part C: "a commercial container for requirement, orders and
    profitability, having 1..n Sites." Not the same thing as a Site.
    """

    __tablename__ = "projects"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_manager: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contractor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    architect: Mapped[str | None] = mapped_column(String(200), nullable=True)
    expected_completion: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    sites: Mapped[list["Site"]] = relationship(order_by="Site.created_at")


class Site(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Part C: "a physical delivery destination." D3: carries its own
    GSTIN, often different from the customer's billing GSTIN -- e.g. a
    builder's site in another state. This is the detail generic ERPs get
    wrong for e-way-bill ship-to handling.
    """

    __tablename__ = "sites"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
