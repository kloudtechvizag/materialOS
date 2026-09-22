import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.hostel import Hostel
from app.models.tenant import Company
from app.models.user import User
from app.schemas.hostel import HostelCreate, HostelOut, HostelRoomCreate, HostelRoomOut, RoomOccupancyOut, StudentHostelAllocationCreate, StudentHostelOut
from app.services.hostel import allocate_student, create_hostel, create_room, get_room_occupancy, get_student_hostel, list_hostels, list_rooms

router = APIRouter(tags=["hostel"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


@router.get("/hostels", response_model=list[HostelOut])
def list_hostels_endpoint(
    branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.view"))
) -> list[Hostel]:
    return list_hostels(db, tenant_id=user.tenant_id, branch_id=branch_id)


@router.post("/hostels", response_model=HostelOut, status_code=201)
def create_hostel_endpoint(payload: HostelCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.create"))) -> Hostel:
    company = _company(db, user.tenant_id)
    return create_hostel(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/hostels/{hostel_id}/rooms", response_model=list[HostelRoomOut])
def list_rooms_endpoint(hostel_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.view"))):
    return list_rooms(db, tenant_id=user.tenant_id, hostel_id=hostel_id)


@router.post("/hostels/{hostel_id}/rooms", response_model=HostelRoomOut, status_code=201)
def create_room_endpoint(hostel_id: uuid.UUID, payload: HostelRoomCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.create"))):
    return create_room(db, tenant_id=user.tenant_id, hostel_id=hostel_id, **payload.model_dump())


@router.get("/hostel-rooms/{room_id}/occupancy", response_model=RoomOccupancyOut)
def room_occupancy_endpoint(room_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.view"))):
    return get_room_occupancy(db, tenant_id=user.tenant_id, room_id=room_id)


@router.post("/students/{student_id}/hostel-allocation", status_code=201)
def allocate_student_endpoint(
    student_id: uuid.UUID, payload: StudentHostelAllocationCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.edit"))
):
    allocate_student(db, tenant_id=user.tenant_id, student_id=student_id, **payload.model_dump())
    return {"status": "allocated"}


@router.get("/students/{student_id}/hostel", response_model=StudentHostelOut | None)
def student_hostel_endpoint(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("hostel.view"))):
    return get_student_hostel(db, tenant_id=user.tenant_id, student_id=student_id)
