"""Communication Center (spec sec20) -- scoped to a real, honest
channel: staff post an announcement targeted at the whole school, one
class, or one section, and it appears in the Guardian Portal (ADR-032)
for exactly the guardians whose linked children are actually in scope.

Deliberately NOT built in this pass (named, not faked): SMS/email/
WhatsApp/push delivery (models/notifications.py's own docstring
already documents this gap platform-wide -- in-app is "the one real
channel"; this ADR doesn't change that), draft/scheduled publishing
(every announcement is published immediately on creation), staff-to-
staff messaging, and two-way parent-teacher messaging (this is a
one-way broadcast, not a conversation).
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

ANNOUNCEMENT_TARGET_TYPES = ["school", "class", "section"]


class Announcement(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "announcements"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(4000), nullable=False)
    # school -- every guardian sees it; class/section -- only guardians
    # with a child currently enrolled there (services/announcements.py
    # resolves this live off StudentEnrolment, never a cached
    # audience list).
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_school_class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    target_section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=True, index=True
    )
    published_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Optional -- an announcement with no expiry stays visible
    # indefinitely, same "don't force a field nobody needs" reasoning
    # StudentEnrolment.section_id nullability already established.
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)


class AnnouncementRead(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Tracked per Guardian, not per User -- a guardian's read state
    should survive a portal password reset or a future second login
    method; it's the guardian's own fact, not the credential's."""

    __tablename__ = "announcement_reads"
    __table_args__ = (UniqueConstraint("tenant_id", "announcement_id", "guardian_id", name="uq_announcement_reads_guardian"),)

    announcement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    guardian_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False, index=True
    )
