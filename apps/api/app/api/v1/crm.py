import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.crm import Lead
from app.models.tenant import Company
from app.models.user import User
from app.schemas.crm import LeadConvertRequest, LeadConvertResult, LeadCreate, LeadOut, LeadUpdate
from app.services.crm import convert_lead_to_customer, create_lead

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: str | None = None, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("leads.view")),
) -> list[Lead]:
    stmt = select(Lead).order_by(Lead.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(Lead.status == status)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=LeadOut, status_code=201)
def create_lead_endpoint(
    payload: LeadCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("leads.create")),
) -> Lead:
    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    return create_lead(db, tenant_id=user.tenant_id, company_id=company.id, data=payload.model_dump())


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: uuid.UUID, payload: LeadUpdate, db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("leads.edit")),
) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise AppError(ErrorCode.NOT_FOUND, "Lead not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.flush()
    return lead


@router.post("/{lead_id}/convert", response_model=LeadConvertResult)
def convert_lead(
    lead_id: uuid.UUID, payload: LeadConvertRequest, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("leads.manage")),
) -> dict:
    lead, customer = convert_lead_to_customer(
        db, tenant_id=user.tenant_id, lead_id=lead_id,
        billing_state=payload.billing_state, credit_limit=payload.credit_limit, credit_days=payload.credit_days,
    )
    return {"lead": lead, "customer": customer}
