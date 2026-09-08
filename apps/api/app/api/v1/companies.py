import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.industry import IndustryProfile
from app.models.tenant import Company
from app.schemas.industry import IndustryProfileOut
from app.schemas.tenant import CompanyComplianceUpdate, CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])


def _to_company_out(db: Session, company: Company) -> CompanyOut:
    # No ORM relationship() for this FK -- many-to-one lookups are resolved
    # explicitly in the API/service layer throughout this codebase (see
    # e.g. Item.category_id, Batch.item_id); relationship() here is
    # reserved for header->line-item collections.
    profile = db.get(IndustryProfile, company.industry_profile_id) if company.industry_profile_id else None
    return CompanyOut(
        id=company.id,
        name=company.name,
        legal_name=company.legal_name,
        gstin=company.gstin,
        state=company.state,
        financial_year_start_month=company.financial_year_start_month,
        e_invoice_enabled=company.e_invoice_enabled,
        e_way_bill_enabled=company.e_way_bill_enabled,
        industry_profile=IndustryProfileOut.model_validate(profile) if profile else None,
    )


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.view")),
) -> list[CompanyOut]:
    companies = db.execute(select(Company).order_by(Company.created_at)).scalars().all()
    return [_to_company_out(db, c) for c in companies]


@router.patch("/{company_id}/compliance", response_model=CompanyOut)
def update_compliance_settings(
    company_id: uuid.UUID,
    payload: CompanyComplianceUpdate,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.edit")),
) -> CompanyOut:
    """D2: an admin flips this once they know AATO has crossed ₹5cr --
    see Company.e_invoice_enabled's docstring for why this isn't computed."""
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Company not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(company, field, value)
    db.flush()
    return _to_company_out(db, company)
