from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import set_session_context
from app.errors import AppError, ErrorCode
from app.models.numbering import FinancialYear
from app.models.tenant import Branch, Company, Tenant, Warehouse
from app.models.user import Permission, Role, RolePermission, User, UserRole
from app.schemas.tenant import TenantSignupRequest
from app.security import hash_password
from app.services.accounts import ensure_default_accounts
from app.services.approvals import ensure_default_approval_rules
from app.services.industry import ensure_industry_profile_catalog, get_profile_by_slug
from app.services.notification_rules import ensure_default_notification_rules
from app.services.permissions import ensure_permission_catalog


def _current_financial_year_code(today: date, start_month: int) -> tuple[str, date, date]:
    if today.month >= start_month:
        start = date(today.year, start_month, 1)
        end_year = today.year + 1
    else:
        start = date(today.year - 1, start_month, 1)
        end_year = today.year
    end = date(end_year, start_month, 1).replace(day=1)
    from datetime import timedelta

    end = end - timedelta(days=1)
    code = f"{start.year}-{str(end.year)[-2:]}"
    return code, start, end


def signup_tenant(db: Session, req: TenantSignupRequest) -> dict:
    existing = db.execute(select(Tenant).where(Tenant.slug == req.tenant_slug)).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "Tenant slug already in use.", status_code=409)

    # Both flush-only (see their docstrings) -- safe to call here and
    # folded into this function's own commit below. Signup must not
    # trust main.py's lifespan having run first: nothing guarantees
    # that in general, and concretely does not hold for FastAPI
    # TestClient without an explicit `with` block, which is most of
    # this test suite -- CI runs pytest against a freshly migrated
    # database with no API process ever having booted.
    ensure_permission_catalog(db)
    ensure_industry_profile_catalog(db)

    industry_profile = get_profile_by_slug(db, req.industry_slug)
    if industry_profile is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown industry_slug: {req.industry_slug!r}", status_code=422)

    tenant = Tenant(name=req.tenant_name, slug=req.tenant_slug, status="active")
    db.add(tenant)
    db.flush()  # need tenant.id before we can set RLS context for its own rows

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    company = Company(
        tenant_id=tenant.id,
        name=req.company_name,
        legal_name=req.company_legal_name,
        state=req.company_state,
        financial_year_start_month=4,
        industry_profile_id=industry_profile.id,
    )
    db.add(company)
    db.flush()

    branch = Branch(tenant_id=tenant.id, company_id=company.id, name="Main Branch", code="MAIN")
    db.add(branch)
    db.flush()

    # A brand-new tenant needs somewhere to post opening stock during its
    # first Tally/Busy import (Slice 0 acceptance test) -- without this,
    # commit_batch has no warehouse to write the stock ledger against.
    warehouse = Warehouse(tenant_id=tenant.id, branch_id=branch.id, name="Main Godown", code="MAIN")
    db.add(warehouse)
    db.flush()

    code, start, end = _current_financial_year_code(date.today(), company.financial_year_start_month)
    financial_year = FinancialYear(
        tenant_id=tenant.id, company_id=company.id, code=code, start_date=start, end_date=end
    )
    db.add(financial_year)

    owner_role = Role(tenant_id=tenant.id, name="owner", is_system=True)
    db.add(owner_role)
    db.flush()

    all_permissions = db.execute(select(Permission)).scalars().all()
    for permission in all_permissions:
        db.add(RolePermission(tenant_id=tenant.id, role_id=owner_role.id, permission_id=permission.id))

    user = User(
        tenant_id=tenant.id,
        email=req.owner_email,
        hashed_password=hash_password(req.owner_password),
        full_name=req.owner_full_name,
    )
    db.add(user)
    db.flush()

    db.add(UserRole(tenant_id=tenant.id, user_id=user.id, role_id=owner_role.id, branch_id=None))

    ensure_default_accounts(db, tenant_id=tenant.id, company_id=company.id)
    ensure_default_approval_rules(db, tenant_id=tenant.id)
    ensure_default_notification_rules(db, tenant_id=tenant.id)

    db.commit()

    return {
        "tenant_id": tenant.id,
        "company_id": company.id,
        "branch_id": branch.id,
        "warehouse_id": warehouse.id,
        "user_id": user.id,
    }
