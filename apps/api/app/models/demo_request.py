from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class DemoRequest(Base, UUIDPk, TimestampMixin):
    """A prospect submitting the public marketing site's "Book a demo"
    form -- platform-level like IndustryProfile (no tenant_id, no RLS
    policy: this row exists before any tenant does, so there is no
    tenant to scope it to)."""

    __tablename__ = "demo_requests"

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry_slug: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_page: Mapped[str | None] = mapped_column(String(200), nullable=True)
