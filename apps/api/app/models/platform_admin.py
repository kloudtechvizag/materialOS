from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class PlatformAdmin(Base, UUIDPk, TimestampMixin):
    """A MaterialOS platform operator (you), not a tenant user -- deliberately
    its own table rather than a flag on User, since User is TenantMixin
    (every row belongs to exactly one tenant) and a platform admin's whole
    point is to operate across tenants. No RLS (same reasoning as Tenant
    itself): there is no tenant context to scope this to.

    No public signup route exists for this table on purpose -- see
    scripts/create_platform_admin.py. Creating platform admins is a
    deliberate, out-of-band operator action, not a self-service flow.
    """

    __tablename__ = "platform_admins"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
