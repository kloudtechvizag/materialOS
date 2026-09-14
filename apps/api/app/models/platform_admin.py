import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class PlatformAdmin(Base, UUIDPk, TimestampMixin):
    """A MaterialOS platform operator (you), not a tenant user -- deliberately
    its own table rather than a flag on User, since User is TenantMixin
    (every row belongs to exactly one tenant) and a platform admin's whole
    point is to operate across tenants. No RLS (same reasoning as Tenant
    itself): there is no tenant context to scope this to.

    No public signup route exists for this table -- the only way in is
    scripts/create_platform_admin.py (the very first admin, out-of-band)
    or POST /platform/admins (ADR-020's admin-creation UI, gated by the
    acting admin re-entering their own current password). Either way,
    `created_by_admin_id` records who vouched for this admin -- NULL
    only for one bootstrapped via the script, never for one created
    in-app.
    """

    __tablename__ = "platform_admins"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_admins.id", ondelete="SET NULL"), nullable=True
    )
