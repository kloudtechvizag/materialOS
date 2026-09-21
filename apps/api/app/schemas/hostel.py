import uuid

from pydantic import BaseModel


class HostelOut(BaseModel):
    id: uuid.UUID
    name: str
    hostel_type: str
    warden_id: uuid.UUID | None
    is_active: bool

    class Config:
        from_attributes = True


class HostelCreate(BaseModel):
    name: str
    hostel_type: str = "co_ed"
    warden_id: uuid.UUID | None = None


class HostelRoomOut(BaseModel):
    id: uuid.UUID
    hostel_id: uuid.UUID
    room_number: str
    floor: str | None
    capacity: int

    class Config:
        from_attributes = True


class HostelRoomCreate(BaseModel):
    room_number: str
    floor: str | None = None
    capacity: int = 1


class StudentHostelAllocationCreate(BaseModel):
    academic_year_id: uuid.UUID
    room_id: uuid.UUID
    bed_number: int


class RoomOccupantOut(BaseModel):
    student_id: uuid.UUID
    first_name: str
    last_name: str
    bed_number: int


class RoomOccupancyOut(BaseModel):
    room_id: uuid.UUID
    room_number: str
    capacity: int
    occupants: list[RoomOccupantOut]


class StudentHostelOut(BaseModel):
    hostel_name: str
    room_number: str
    bed_number: int
    warden_name: str | None
    warden_phone: str | None
