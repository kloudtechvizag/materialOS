import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.tenant import Company
from app.models.transport import TransportRoute
from app.models.user import User
from app.schemas.transport import (
    RouteRosterEntryOut,
    RouteStopCreate,
    RouteStopOut,
    StudentTransportAssignmentCreate,
    StudentTransportOut,
    TransportRouteCreate,
    TransportRouteOut,
)
from app.services.transport import assign_student_to_route, create_route, create_stop, get_route_roster, get_student_transport, list_routes, list_stops

router = APIRouter(tags=["transport"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


@router.get("/transport-routes", response_model=list[TransportRouteOut])
def list_routes_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.view"))) -> list[TransportRoute]:
    return list_routes(db, tenant_id=user.tenant_id)


@router.post("/transport-routes", response_model=TransportRouteOut, status_code=201)
def create_route_endpoint(
    payload: TransportRouteCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.create"))
) -> TransportRoute:
    company = _company(db, user.tenant_id)
    return create_route(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/transport-routes/{route_id}/stops", response_model=list[RouteStopOut])
def list_stops_endpoint(route_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.view"))):
    return list_stops(db, tenant_id=user.tenant_id, route_id=route_id)


@router.post("/transport-routes/{route_id}/stops", response_model=RouteStopOut, status_code=201)
def create_stop_endpoint(
    route_id: uuid.UUID, payload: RouteStopCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.create"))
):
    return create_stop(db, tenant_id=user.tenant_id, route_id=route_id, **payload.model_dump())


@router.get("/transport-routes/{route_id}/roster", response_model=list[RouteRosterEntryOut])
def route_roster_endpoint(route_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.view"))):
    return get_route_roster(db, tenant_id=user.tenant_id, route_id=route_id)


@router.post("/students/{student_id}/transport-assignment", status_code=201)
def assign_student_endpoint(
    student_id: uuid.UUID, payload: StudentTransportAssignmentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.edit"))
):
    assign_student_to_route(db, tenant_id=user.tenant_id, student_id=student_id, **payload.model_dump())
    return {"status": "assigned"}


@router.get("/students/{student_id}/transport", response_model=StudentTransportOut | None)
def student_transport_endpoint(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("transport.view"))):
    return get_student_transport(db, tenant_id=user.tenant_id, student_id=student_id)
