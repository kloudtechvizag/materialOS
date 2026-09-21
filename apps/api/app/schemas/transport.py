import uuid
from datetime import time

from pydantic import BaseModel


class TransportRouteOut(BaseModel):
    id: uuid.UUID
    name: str
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    is_active: bool

    class Config:
        from_attributes = True


class TransportRouteCreate(BaseModel):
    name: str
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID


class RouteStopOut(BaseModel):
    id: uuid.UUID
    route_id: uuid.UUID
    name: str
    sequence: int
    pickup_time: time
    drop_time: time

    class Config:
        from_attributes = True


class RouteStopCreate(BaseModel):
    name: str
    sequence: int
    pickup_time: time
    drop_time: time


class StudentTransportAssignmentCreate(BaseModel):
    academic_year_id: uuid.UUID
    route_id: uuid.UUID
    stop_id: uuid.UUID


class RouteRosterEntryOut(BaseModel):
    student_id: uuid.UUID
    first_name: str
    last_name: str
    stop_id: uuid.UUID
    stop_name: str


class StudentTransportOut(BaseModel):
    route_id: uuid.UUID
    route_name: str
    vehicle_registration_number: str
    driver_name: str
    driver_phone: str | None
    stop_name: str
    pickup_time: time
    drop_time: time
