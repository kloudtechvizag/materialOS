import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.tenant import Company
from app.schemas.tenant import CompanyComplianceUpdate, CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.view")),
) -> list[Company]:
    return db.execute(select(Company).order_by(Company.created_at)).scalars().all()


@router.patch("/{company_id}/compliance", response_model=CompanyOut)
def update_compliance_settings(
    company_id: uuid.UUID,
    payload: CompanyComplianceUpdate,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.edit")),
) -> Company:
    """D2: an admin flips this once they know AATO has crossed ₹5cr --
    see Company.e_invoice_enabled's docstring for why this isn't computed."""
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Company not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(company, field, value)
    db.flush()
    return company
