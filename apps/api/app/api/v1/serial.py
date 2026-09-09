import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.serial import RmaRequest, SerialUnit
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.serial import (
    RmaRequestCreate,
    RmaRequestOut,
    RmaRequestUpdate,
    SerialUnitCreate,
    SerialUnitOut,
    SerialUnitUpdate,
)
from app.services.numbering import get_current_financial_year
from app.services.serial import create_rma_request, register_serial_unit, transition_rma

router = APIRouter(tags=["serial"])


@router.get("/serial-units", response_model=list[SerialUnitOut])
def list_serial_units(
    item_id: uuid.UUID | None = None, serial_number: str | None = None,
    db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("items.view")),
) -> list[SerialUnit]:
    stmt = select(SerialUnit).order_by(SerialUnit.created_at.desc()).limit(200)
    if item_id:
        stmt = stmt.where(SerialUnit.item_id == item_id)
    if serial_number:
        stmt = stmt.where(SerialUnit.serial_number.ilike(f"%{serial_number}%"))
    return db.execute(stmt).scalars().all()


@router.post("/serial-units", response_model=SerialUnitOut, status_code=201)
def create_serial_unit(
    payload: SerialUnitCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("items.edit")),
) -> SerialUnit:
    return register_serial_unit(db, tenant_id=user.tenant_id, data=payload.model_dump())


@router.patch("/serial-units/{serial_unit_id}", response_model=SerialUnitOut)
def update_serial_unit(
    serial_unit_id: uuid.UUID, payload: SerialUnitUpdate, db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("items.edit")),
) -> SerialUnit:
    unit = db.get(SerialUnit, serial_unit_id)
    if unit is None:
        raise AppError(ErrorCode.NOT_FOUND, "Serial unit not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    db.flush()
    return unit


@router.get("/rma-requests", response_model=list[RmaRequestOut])
def list_rma_requests(
    status: str | None = None, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("rma.view")),
) -> list[RmaRequest]:
    stmt = select(RmaRequest).order_by(RmaRequest.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(RmaRequest.status == status)
    return db.execute(stmt).scalars().all()


@router.post("/rma-requests", response_model=RmaRequestOut, status_code=201)
def create_rma_request_endpoint(
    payload: RmaRequestCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("rma.create")),
) -> RmaRequest:
    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    fy = get_current_financial_year(db, company.id)
    return create_rma_request(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        serial_unit_id=payload.serial_unit_id, customer_id=payload.customer_id, reason=payload.reason,
    )


@router.patch("/rma-requests/{rma_id}", response_model=RmaRequestOut)
def update_rma_request(
    rma_id: uuid.UUID, payload: RmaRequestUpdate, db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("rma.edit")),
) -> RmaRequest:
    if payload.status is None:
        rma = db.get(RmaRequest, rma_id)
        if rma is None:
            raise AppError(ErrorCode.NOT_FOUND, "RMA request not found.", status_code=404)
        if payload.resolution_notes is not None:
            rma.resolution_notes = payload.resolution_notes
        db.flush()
        return rma
    return transition_rma(
        db, rma_id=rma_id, new_status=payload.status, resolution=payload.resolution, resolution_notes=payload.resolution_notes,
    )
