"""Transport (Phase 6, spec sec18): school bus routes, built on the
existing core Vehicle/Driver masters (models/fleet.py) rather than a
parallel vehicle registry -- a school bus is not architecturally
different from any other vehicle this codebase already tracks, and
Vehicle/Driver are already tenant-generic (no delivery-specific
fields, not gated behind any industry module).

`Trip` (also in models/fleet.py) is NOT reused -- it is a one-off
per-day delivery run tied to DeliveryChallans, whereas a school route
is a persistent, recurring assignment (the same vehicle+driver run the
same stops every school day). TransportRoute is the genuinely new
concept this domain needs.
"""

import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class TransportRoute(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "transport_routes"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # "Route 1 - North"
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class RouteStop(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "route_stops"
    __table_args__ = (UniqueConstraint("tenant_id", "route_id", "sequence", name="uq_route_stops_sequence"),)

    route_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    pickup_time: Mapped[time] = mapped_column(Time, nullable=False)
    drop_time: Mapped[time] = mapped_column(Time, nullable=False)


class StudentTransportAssignment(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One row per student per academic year -- same "history is never
    silently overwritten" reasoning as StudentEnrolment (ADR-025): a
    route change mid-year is a real, later slice's problem (named
    below), not something this table needs to solve by allowing
    multiple live rows per year."""

    __tablename__ = "student_transport_assignments"
    __table_args__ = (UniqueConstraint("tenant_id", "student_id", "academic_year_id", name="uq_student_transport_year"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    route_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transport_routes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    stop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("route_stops.id", ondelete="RESTRICT"), nullable=False, index=True
    )
