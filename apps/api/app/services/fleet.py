import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.fleet import ProofOfDelivery, Trip
from app.models.sales import DeliveryChallan


def create_trip(
    db: Session, *, tenant_id: uuid.UUID, branch_id: uuid.UUID, vehicle_id: uuid.UUID, driver_id: uuid.UUID,
    trip_date: date,
) -> Trip:
    trip = Trip(tenant_id=tenant_id, branch_id=branch_id, vehicle_id=vehicle_id, driver_id=driver_id, trip_date=trip_date)
    db.add(trip)
    db.flush()
    return trip


def assign_challan_to_trip(db: Session, *, trip_id: uuid.UUID, delivery_challan_id: uuid.UUID) -> DeliveryChallan:
    challan = db.get(DeliveryChallan, delivery_challan_id)
    if challan is None:
        raise AppError(ErrorCode.NOT_FOUND, "Delivery challan not found.", status_code=404)
    challan.trip_id = trip_id
    db.flush()
    return challan


def start_trip(db: Session, *, trip_id: uuid.UUID) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError(ErrorCode.NOT_FOUND, "Trip not found.", status_code=404)
    trip.status = "started"
    db.execute(
        DeliveryChallan.__table__.update()
        .where(DeliveryChallan.trip_id == trip_id, DeliveryChallan.status == "dispatched")
        .values(status="in_transit")
    )
    db.flush()
    return trip


def capture_pod(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    delivery_challan_id: uuid.UUID,
    receiver_name: str,
    signature_data_url: str | None,
    photo_path: str | None,
    latitude: Decimal | None,
    longitude: Decimal | None,
    status: str,
    shortage_notes: str | None,
) -> ProofOfDelivery:
    """dev.md §46. Scope note: a shortage/damage report here is captured
    as text for the office to act on -- it does not itself post a stock
    reversal, because "goods returned to stock" vs "written off as
    damage" is a real decision a human has to make, not something to
    infer from a note field.
    """
    challan = db.get(DeliveryChallan, delivery_challan_id)
    if challan is None:
        raise AppError(ErrorCode.NOT_FOUND, "Delivery challan not found.", status_code=404)

    existing = db.execute(
        select(ProofOfDelivery).where(ProofOfDelivery.delivery_challan_id == delivery_challan_id)
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "Proof of delivery already captured for this challan.", status_code=409)

    pod = ProofOfDelivery(
        tenant_id=tenant_id,
        delivery_challan_id=delivery_challan_id,
        receiver_name=receiver_name,
        signature_data_url=signature_data_url,
        photo_path=photo_path,
        latitude=latitude,
        longitude=longitude,
        delivered_at=datetime.now(),
        status=status,
        shortage_notes=shortage_notes,
    )
    db.add(pod)

    challan.status = "delivered" if status in ("delivered", "partial") else "failed"
    db.flush()

    all_challans_done = db.execute(
        select(DeliveryChallan).where(DeliveryChallan.trip_id == challan.trip_id, DeliveryChallan.status.in_(["dispatched", "in_transit"]))
    ).scalars().all()
    if challan.trip_id and not all_challans_done:
        trip = db.get(Trip, challan.trip_id)
        if trip:
            trip.status = "completed"
            db.flush()

    return pod
