import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.fleet import Driver, Trip, Vehicle
from app.services.entitlements import require_feature
from app.models.user import User
from app.schemas.fleet import (
    AssignChallanRequest,
    DriverCreate,
    DriverOut,
    PodOut,
    TripCreate,
    TripOut,
    VehicleCreate,
    VehicleOut,
)
from app.services.fleet import assign_challan_to_trip, capture_pod, create_trip, start_trip
from app.storage import save_file

router = APIRouter(tags=["fleet"])


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list[Vehicle]:
    return db.execute(select(Vehicle).where(Vehicle.is_active.is_(True)).order_by(Vehicle.registration_number)).scalars().all()


@router.post("/vehicles", response_model=VehicleOut, status_code=201)
def create_vehicle(
    payload: VehicleCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("customers.create")),
) -> Vehicle:
    vehicle = Vehicle(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(vehicle)
    db.flush()
    return vehicle


@router.get("/drivers", response_model=list[DriverOut])
def list_drivers(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list[Driver]:
    return db.execute(select(Driver).where(Driver.is_active.is_(True)).order_by(Driver.name)).scalars().all()


@router.post("/drivers", response_model=DriverOut, status_code=201)
def create_driver(
    payload: DriverCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("customers.create")),
) -> Driver:
    driver = Driver(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(driver)
    db.flush()
    return driver


@router.get("/trips", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list[Trip]:
    return db.execute(select(Trip).order_by(Trip.created_at.desc())).scalars().all()


@router.get("/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError(ErrorCode.NOT_FOUND, "Trip not found.", status_code=404)
    return trip


@router.post("/trips", response_model=TripOut, status_code=201)
def create_trip_endpoint(
    payload: TripCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("customers.create")),
    _entitled=Depends(require_feature("module.fleet")),
) -> Trip:
    trip = create_trip(db, tenant_id=user.tenant_id, **payload.model_dump())
    return trip


@router.post("/trips/{trip_id}/assign", response_model=TripOut)
def assign_challan(
    trip_id: uuid.UUID, payload: AssignChallanRequest, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.edit")),
) -> Trip:
    assign_challan_to_trip(db, trip_id=trip_id, delivery_challan_id=payload.delivery_challan_id)
    return db.get(Trip, trip_id)


@router.post("/trips/{trip_id}/start", response_model=TripOut)
def start_trip_endpoint(
    trip_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.edit")),
) -> Trip:
    return start_trip(db, trip_id=trip_id)


@router.post("/delivery-challans/{delivery_challan_id}/pod", response_model=PodOut)
async def submit_pod(
    delivery_challan_id: uuid.UUID,
    receiver_name: str = Form(...),
    signature_data_url: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    status: str = Form("delivered"),
    shortage_notes: str | None = Form(None),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.edit")),
):
    photo_path = None
    if photo is not None:
        content = await photo.read()
        photo_path = save_file(tenant_id=user.tenant_id, category="pod", file_name=photo.filename or "photo.jpg", content=content)

    return capture_pod(
        db,
        tenant_id=user.tenant_id,
        delivery_challan_id=delivery_challan_id,
        receiver_name=receiver_name,
        signature_data_url=signature_data_url,
        photo_path=photo_path,
        latitude=Decimal(str(latitude)) if latitude is not None else None,
        longitude=Decimal(str(longitude)) if longitude is not None else None,
        status=status,
        shortage_notes=shortage_notes,
    )
