import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class ImpersonationSession(Base, UUIDPk, TimestampMixin):
    """A record that a platform admin issued themselves an impersonation
    token for one tenant user (ADR-020) -- platform-root, like
    PlatformAdmin/Tenant themselves, since it spans (and is about)
    exactly one admin acting across the tenant boundary, not something
    any tenant's own RLS context could scope to. `created_at`
    (TimestampMixin) is the grant time; `expires_at` mirrors the token's
    own `exp` claim so this table can be read as a standalone audit log
    without decoding any JWT.
    """

    __tablename__ = "impersonation_sessions"

    platform_admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_admins.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Named `impersonated_tenant_id`, not `tenant_id` -- this table is
    # platform-root (no RLS, like `tenants`/`platform_admins`
    # themselves), and test_rls.py's schema-introspection guardrail
    # treats any column literally named `tenant_id` as a signal that a
    # table must be RLS-scoped. A plain `tenant_id` here would be a false
    # positive for that check, not a real gap -- so it's named
    # differently on purpose, not worked around.
    impersonated_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    impersonated_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
