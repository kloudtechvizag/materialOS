import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class VehicleOut(BaseModel):
    id: uuid.UUID
    registration_number: str
    vehicle_type: str
    capacity_kg: Decimal
    ownership: str
    is_active: bool

    class Config:
        from_attributes = True


class VehicleCreate(BaseModel):
    branch_id: uuid.UUID
    registration_number: str
    vehicle_type: str
    capacity_kg: Decimal = Decimal("0")
    ownership: str = "own"


class DriverOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    license_number: str | None
    is_active: bool

    class Config:
        from_attributes = True


class DriverCreate(BaseModel):
    branch_id: uuid.UUID
    name: str
    phone: str | None = None
    license_number: str | None = None


class TripCreate(BaseModel):
    branch_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    trip_date: date


class DeliveryChallanSummary(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    sales_order_id: uuid.UUID

    class Config:
        from_attributes = True


class TripOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    trip_date: date
    status: str
    deliveries: list[DeliveryChallanSummary] = []

    class Config:
        from_attributes = True


class AssignChallanRequest(BaseModel):
    delivery_challan_id: uuid.UUID


class PodCreate(BaseModel):
    receiver_name: str
    signature_data_url: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    status: str = "delivered"  # delivered | partial | failed
    shortage_notes: str | None = None


class PodOut(BaseModel):
    id: uuid.UUID
    delivery_challan_id: uuid.UUID
    receiver_name: str
    photo_path: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    delivered_at: datetime
    status: str
    shortage_notes: str | None

    class Config:
        from_attributes = True
