from datetime import date
from decimal import Decimal
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.numbering import FinancialYear
from app.models.industry import IndustryProfile
from app.models.masters import Customer, Item, Supplier
from app.models.sales import Invoice, SalesOrder
from app.models.tenant import Branch, Company, Warehouse
from app.schemas.industry import IndustryProfileOut
from app.schemas.tenant import (
    CompanyActivitySummary,
    CompanyComplianceUpdate,
    CompanyForkRequest,
    CompanyIndustryUpdate,
    CompanyOut,
)
from app.services.accounts import ensure_default_accounts
from app.services.industry import get_profile_by_slug
from app.services.jewellery import ensure_jewellery_category
from app.services.tenant_signup import _current_financial_year_code

router = APIRouter(prefix="/companies", tags=["companies"])


def _to_company_out(db: Session, company: Company) -> CompanyOut:
    # No ORM relationship() for this FK -- many-to-one lookups are resolved
    # explicitly in the API/service layer throughout this codebase (see
    # e.g. Item.category_id, Batch.item_id); relationship() here is
    # reserved for header->line-item collections.
    profile = db.get(IndustryProfile, company.industry_profile_id) if company.industry_profile_id else None
    logo_url = "/api/v1/tenant/branding/logo" if company.logo_path else None
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
        logo_url=logo_url,
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


@router.patch("/{company_id}/industry-profile", response_model=CompanyOut)
def update_industry_profile(
    company_id: uuid.UUID,
    payload: CompanyIndustryUpdate,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.edit")),
) -> CompanyOut:
    """ADR-010: profile switch is a single FK write -- the sidebar,
    dashboard, and item-attribute rendering are all read live off
    Company.industry_profile via useIndustryProfile(), so nothing else
    needs to change for the switch to take effect. No data migration:
    existing items/customers/etc. are untouched, only which
    modules/widgets/terminology are shown changes. Audited automatically
    by the existing companies audit trigger (old/new industry_profile_id
    on the row), same as any other company edit."""
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Company not found.", status_code=404)
    profile = get_profile_by_slug(db, payload.industry_slug)
    if profile is None:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, f"Unknown industry_slug: {payload.industry_slug!r}", status_code=422
        )
    company.industry_profile_id = profile.id
    if profile.slug == "jewellery":
        ensure_jewellery_category(db, tenant_id=company.tenant_id, company_id=company.id)
    db.flush()
    return _to_company_out(db, company)


@router.get("/{company_id}/activity-summary", response_model=CompanyActivitySummary)
def get_company_activity_summary(
    company_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.view")),
) -> CompanyActivitySummary:
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Company not found.", status_code=404)

    inv_count = db.execute(select(func.count()).select_from(Invoice).where(Invoice.company_id == company.id)).scalar() or 0
    ord_count = db.execute(select(func.count()).select_from(SalesOrder).where(SalesOrder.company_id == company.id)).scalar() or 0
    item_count = db.execute(select(func.count()).select_from(Item).where(Item.company_id == company.id)).scalar() or 0
    cust_count = db.execute(select(func.count()).select_from(Customer).where(Customer.company_id == company.id)).scalar() or 0

    has_tx = bool(inv_count > 0 or ord_count > 0 or item_count > 0)
    return CompanyActivitySummary(
        invoices_count=inv_count,
        orders_count=ord_count,
        items_count=item_count,
        customers_count=cust_count,
        has_transactions=has_tx,
    )


@router.post("/fork", response_model=CompanyOut)
def fork_sister_company(
    payload: CompanyForkRequest,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.edit")),
) -> CompanyOut:
    """Intelligent Multi-Company Fork: creates a Sister Company with the target
    industry profile, preserving existing company records and optionally
    copying customer/supplier party masters with clean opening balances."""
    source_company = db.get(Company, payload.source_company_id)
    if source_company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Source company not found.", status_code=404)

    target_profile = get_profile_by_slug(db, payload.industry_slug)
    if target_profile is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown industry_slug: {payload.industry_slug!r}", status_code=422)

    new_company = Company(
        tenant_id=source_company.tenant_id,
        name=payload.name.strip(),
        legal_name=payload.legal_name.strip() if payload.legal_name else payload.name.strip(),
        state=source_company.state,
        city=source_company.city,
        financial_year_start_month=source_company.financial_year_start_month,
        industry_profile_id=target_profile.id,
    )
    db.add(new_company)
    db.flush()

    branch = Branch(tenant_id=new_company.tenant_id, company_id=new_company.id, name="Main Branch", code="MAIN")
    db.add(branch)
    db.flush()

    warehouse = Warehouse(tenant_id=new_company.tenant_id, branch_id=branch.id, name="Main Godown", code="MAIN")
    db.add(warehouse)
    db.flush()

    code, start, end = _current_financial_year_code(date.today(), new_company.financial_year_start_month)
    financial_year = FinancialYear(
        tenant_id=new_company.tenant_id, company_id=new_company.id, code=code, start_date=start, end_date=end
    )
    db.add(financial_year)

    ensure_default_accounts(db, tenant_id=new_company.tenant_id, company_id=new_company.id)
    if target_profile.slug == "jewellery":
        ensure_jewellery_category(db, tenant_id=new_company.tenant_id, company_id=new_company.id)

    if payload.clone_parties:
        customers = db.execute(
            select(Customer).where(Customer.company_id == source_company.id, Customer.is_active == True)  # noqa: E712
        ).scalars().all()
        for c in customers:
            db.add(
                Customer(
                    tenant_id=new_company.tenant_id,
                    company_id=new_company.id,
                    name=c.name,
                    gstin=c.gstin,
                    phone=c.phone,
                    email=c.email,
                    billing_state=c.billing_state,
                    credit_limit=c.credit_limit,
                    credit_days=c.credit_days,
                    opening_balance=Decimal("0"),
                    is_active=True,
                )
            )

        suppliers = db.execute(
            select(Supplier).where(Supplier.company_id == source_company.id, Supplier.is_active == True)  # noqa: E712
        ).scalars().all()
        for s in suppliers:
            db.add(
                Supplier(
                    tenant_id=new_company.tenant_id,
                    company_id=new_company.id,
                    name=s.name,
                    gstin=s.gstin,
                    phone=s.phone,
                    email=s.email,
                    billing_state=s.billing_state,
                    category=s.category,
                    opening_balance=Decimal("0"),
                    is_active=True,
                )
            )

    db.flush()
    return _to_company_out(db, new_company)

