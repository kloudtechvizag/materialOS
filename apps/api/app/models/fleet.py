import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk


class Vehicle(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "vehicles"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    registration_number: Mapped[str] = mapped_column(String(20), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "6-wheeler", "mini truck"
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    ownership: Mapped[str] = mapped_column(String(20), nullable=False, default="own")  # own | contracted
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Driver(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "drivers"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # set once the driver has a login for the mobile-web app (ADR-005)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Trip(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A vehicle+driver's route for a day; carries one or more delivery
    challans (dev.md §42-45's dispatch board and driver app both key off
    this). status: planned -> started -> completed.
    """

    __tablename__ = "trips"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    trip_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")

    deliveries: Mapped[list["DeliveryChallan"]] = relationship(order_by="DeliveryChallan.created_at")


class ProofOfDelivery(Base, UUIDPk, TenantMixin, TimestampMixin):
    """dev.md §46: signature, photo, timestamp, GPS, receiver name,
    quantity delivered, shortage, damage, notes. Captured via mobile web
    (ADR-005) -- signature as a canvas-exported PNG data URL, photo via
    the device camera input, GPS via the browser Geolocation API.
    """

    __tablename__ = "proof_of_deliveries"
    __table_args__ = (UniqueConstraint("delivery_challan_id", name="uq_pod_delivery_challan"),)

    delivery_challan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_challans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    receiver_name: Mapped[str] = mapped_column(String(200), nullable=False)
    signature_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="delivered")  # delivered|partial|failed
    shortage_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
