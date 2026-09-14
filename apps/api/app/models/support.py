import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"]
TICKET_PRIORITIES = ["low", "normal", "high", "urgent"]


class SupportTicket(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Tenant-scoped like everything else (a tenant user files and reads
    only their own tenant's tickets, enforced by the normal
    tenant_isolation RLS policy), but the platform console needs a real
    global inbox across all tenants -- not a per-tenant loop like the
    tenant directory (ticket volume is naturally sparse; a support
    engineer triaging "all open tickets" is the primary use case, not
    an edge case). See this table's migration for the added platform
    bypass clause -- the only two tables in the schema with one,
    deliberately not a blanket RLS exception.
    """

    __tablename__ = "support_tickets"

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="normal")
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class SupportTicketMessage(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "support_ticket_messages"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Exactly one of these two is set -- a tenant user's own message, or a
    # platform admin's reply. Never both, never neither (enforced in the
    # service layer, not a DB constraint -- consistent with this
    # codebase's general preference for application-level invariants on
    # "exactly one of" columns over a CHECK constraint).
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_platform_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_admins.id", ondelete="SET NULL"), nullable=True
    )
