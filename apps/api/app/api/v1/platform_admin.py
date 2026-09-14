"""ADR-020: the platform admin console -- MaterialOS-the-company operating
MaterialOS-the-product, as distinct from any tenant's own admin/owner role.
Every tenant-scoped read here goes through get_platform_db (no RLS context)
plus an explicit, one-tenant-at-a-time set_session_context call -- the same
loop-per-tenant pattern services/billing_tasks.py's daily job already uses,
not a new way of bypassing RLS.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import set_session_context
from app.deps import get_platform_admin, get_platform_db
from app.errors import AppError, ErrorCode
from app.models.billing_plans import Feature, Plan, PlanFeature
from app.models.platform_admin import PlatformAdmin
from app.models.subscriptions import Subscription
from app.models.tenant import Company, Tenant
from app.models.user import User
from app.schemas.platform_admin import (
    PlatformAdminOut,
    PlatformLoginRequest,
    PlatformTokenResponse,
    TenantDetail,
    TenantListResponse,
    TenantStatusUpdate,
    TenantSummary,
)
from app.security import create_platform_admin_token, verify_password

router = APIRouter(prefix="/platform", tags=["platform-admin"])

VALID_TENANT_STATUSES = {"active", "suspended"}


@router.post("/auth/login", response_model=PlatformTokenResponse)
def login(req: PlatformLoginRequest, db: Session = Depends(get_platform_db)) -> PlatformTokenResponse:
    admin = db.execute(select(PlatformAdmin).where(PlatformAdmin.email == req.email)).scalar_one_or_none()
    if admin is None or not admin.is_active or not verify_password(req.password, admin.hashed_password):
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid email or password.", status_code=401)
    return PlatformTokenResponse(access_token=create_platform_admin_token(admin_id=admin.id))


@router.get("/auth/me", response_model=PlatformAdminOut)
def me(admin: PlatformAdmin = Depends(get_platform_admin)) -> PlatformAdminOut:
    return PlatformAdminOut(id=str(admin.id), email=admin.email, full_name=admin.full_name)


def _tenant_summary(db: Session, tenant: Tenant) -> TenantSummary:
    """Sets its own tenant context, reads that one tenant's Company/User/
    Subscription rows, and hands back a plain summary -- never leaks the
    session's context into the caller's next iteration."""
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    company = db.execute(select(Company).where(Company.tenant_id == tenant.id)).scalars().first()
    user_count = db.execute(
        select(func.count()).select_from(User).where(User.tenant_id == tenant.id, User.is_active == True)  # noqa: E712
    ).scalar_one()
    subscription = db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant.id).order_by(Subscription.created_at.desc())
    ).scalars().first()

    plan_name = None
    if subscription is not None:
        plan = db.get(Plan, subscription.plan_id)
        plan_name = plan.name if plan else None

    return TenantSummary(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        created_at=tenant.created_at,
        company_name=company.name if company else None,
        user_count=user_count,
        plan_name=plan_name,
        subscription_status=subscription.status if subscription else None,
    )


@router.get("/tenants", response_model=TenantListResponse)
def list_tenants(
    q: str | None = None,
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> TenantListResponse:
    # Real-scale finding, not a hypothetical: this devbox alone has 1,460
    # tenants (years of test-suite runs), and _tenant_summary's per-tenant
    # set_session_context loop took ~4s unpaginated against that. Every
    # tenant-scoped read genuinely does need its own context switch (RLS
    # gives no other way to read across tenants from the app's own DB
    # role -- see get_platform_db), so pagination is what keeps a single
    # request's tenant-loop bounded, not a workaround for a query that
    # should just be indexed better.
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    stmt = select(Tenant)
    if q:
        stmt = stmt.where(Tenant.name.ilike(f"%{q}%") | Tenant.slug.ilike(f"%{q}%"))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    page_stmt = stmt.order_by(Tenant.created_at.desc()).limit(page_size).offset((page - 1) * page_size)
    tenants = db.execute(page_stmt).scalars().all()
    return TenantListResponse(
        tenants=[_tenant_summary(db, t) for t in tenants], total=total, page=page, page_size=page_size,
    )


@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
def get_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> TenantDetail:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)

    summary = _tenant_summary(db, tenant)

    active_features: list[str] = []
    subscription = db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant.id).order_by(Subscription.created_at.desc())
    ).scalars().first()
    if subscription is not None:
        active_features = list(
            db.execute(
                select(Feature.code)
                .join(PlanFeature, PlanFeature.feature_id == Feature.id)
                .where(PlanFeature.plan_id == subscription.plan_id, PlanFeature.is_enabled == True)  # noqa: E712
                .order_by(Feature.code)
            ).scalars().all()
        )

    return TenantDetail(**summary.model_dump(), active_features=active_features)


@router.patch("/tenants/{tenant_id}", response_model=TenantSummary)
def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdate,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> TenantSummary:
    if payload.status not in VALID_TENANT_STATUSES:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"status must be one of {sorted(VALID_TENANT_STATUSES)}.",
            status_code=422,
        )
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    tenant.status = payload.status
    db.flush()
    return _tenant_summary(db, tenant)
