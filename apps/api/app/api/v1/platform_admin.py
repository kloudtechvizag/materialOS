"""ADR-020: the platform admin console -- MaterialOS-the-company operating
MaterialOS-the-product, as distinct from any tenant's own admin/owner role.
Every tenant-scoped read here goes through get_platform_db (no RLS context)
plus an explicit, one-tenant-at-a-time set_session_context call -- the same
loop-per-tenant pattern services/billing_tasks.py's daily job already uses,
not a new way of bypassing RLS.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db import set_session_context
from app.deps import get_platform_admin, get_platform_db
from app.errors import AppError, ErrorCode
from app.models.audit import AuditLog
from app.models.billing_plans import Feature, Plan, PlanFeature, PlanLimit
from app.models.impersonation import ImpersonationSession
from app.models.platform_admin import PlatformAdmin
from app.models.subscriptions import Subscription
from app.models.support import TICKET_STATUSES, SupportTicket, SupportTicketMessage
from app.models.tenant import Company, Tenant
from app.models.user import User
from app.schemas.audit import AuditLogOut
from app.schemas.billing_plans import FeatureOut, PlanVersionCreate, PlatformPlanOut
from app.schemas.platform_admin import (
    ImpersonationTokenResponse,
    PlatformAdminCreate,
    PlatformAdminListOut,
    PlatformAdminOut,
    PlatformLoginRequest,
    PlatformTokenResponse,
    TenantArchiveResponse,
    TenantDetail,
    TenantListResponse,
    TenantStatusUpdate,
    TenantSummary,
    TenantUserOut,
)
from app.schemas.support import (
    PlatformSupportTicketOut,
    SupportMessageCreate,
    SupportMessageOut,
    SupportTicketDetail,
    SupportTicketStatusUpdate,
)
from app.security import create_impersonation_token, create_platform_admin_token, hash_password, verify_password
from app.services.backup import run_backup
from app.services.billing_plans import create_plan_version

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


@router.get("/tenants/{tenant_id}/audit-logs", response_model=list[AuditLogOut])
def list_tenant_audit_logs(
    tenant_id: uuid.UUID,
    table_name: str | None = None,
    action: str | None = None,
    occurred_after: datetime | None = None,
    occurred_before: datetime | None = None,
    limit: int = 100,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> list[AuditLog]:
    """Mirrors api/v1/audit.py's tenant-facing query exactly, but scoped to
    one tenant at a time via set_session_context rather than a permission
    check -- audit_log has no platform-bypass RLS clause (unlike
    support_tickets), so a real per-tenant context switch is what makes
    this readable at all (same pattern as _tenant_summary), not a way of
    reading across every tenant at once.
    """
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    stmt = select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(min(limit, 500))
    if table_name:
        stmt = stmt.where(AuditLog.table_name == table_name)
    if action:
        stmt = stmt.where(AuditLog.action == action.upper())
    if occurred_after:
        stmt = stmt.where(AuditLog.occurred_at >= occurred_after)
    if occurred_before:
        stmt = stmt.where(AuditLog.occurred_at <= occurred_before)
    return db.execute(stmt).scalars().all()


@router.get("/tenants/{tenant_id}/audit-logs/tables", response_model=list[str])
def list_tenant_audited_tables(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> list[str]:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    return sorted(db.execute(select(AuditLog.table_name).distinct()).scalars().all())


@router.get("/tenants/{tenant_id}/users", response_model=list[TenantUserOut])
def list_tenant_users(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> list[TenantUserOut]:
    """The impersonation target picker -- same one-tenant-at-a-time
    set_session_context pattern as the audit log and _tenant_summary."""
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    users = db.execute(select(User).where(User.customer_id.is_(None)).order_by(User.full_name)).scalars().all()
    return [TenantUserOut(id=str(u.id), email=u.email, full_name=u.full_name, is_active=u.is_active) for u in users]


@router.post("/tenants/{tenant_id}/users/{user_id}/impersonate", response_model=ImpersonationTokenResponse)
def impersonate_tenant_user(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    admin: PlatformAdmin = Depends(get_platform_admin),
) -> ImpersonationTokenResponse:
    """Issues a real, 15-minute access token for this user (see
    create_impersonation_token) and logs who did it and when
    (ImpersonationSession) before handing it back -- there is no code
    path that grants impersonation access without leaving that record.
    An archived/suspended tenant can't be impersonated into either:
    login itself is already blocked for those (auth.py), so
    impersonation refusing them too keeps the two consistent.
    """
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    if tenant.status != "active":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Tenant is {tenant.status}, not active -- cannot impersonate into it.", status_code=422)

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant.id:
        raise AppError(ErrorCode.NOT_FOUND, "User not found in this tenant.", status_code=404)
    if not user.is_active:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Cannot impersonate an inactive user.", status_code=422)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(ImpersonationSession(platform_admin_id=admin.id, impersonated_tenant_id=tenant.id, impersonated_user_id=user.id, expires_at=expires_at))
    db.flush()

    token = create_impersonation_token(user_id=user.id, tenant_id=tenant.id, admin_id=admin.id)
    return ImpersonationTokenResponse(access_token=token, tenant_slug=tenant.slug, user_email=user.email)


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
    if tenant.status == "archived":
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "Tenant is archived -- restoring an archived tenant is a deliberate, separate action, not a status flip.",
            status_code=422,
        )
    tenant.status = payload.status
    db.flush()
    return _tenant_summary(db, tenant)


@router.post("/tenants/{tenant_id}/archive", response_model=TenantArchiveResponse)
def archive_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> TenantArchiveResponse:
    """Soft-delete: a real, verified backup (services/backup.py, ADR-013)
    is taken and confirmed complete BEFORE anything is deactivated, and
    no row is ever dropped -- reversing this means restoring that backup
    onto a re-activated tenant, a deliberate follow-up action, not a
    status flip. Every user is also flagged inactive so the cutoff is
    immediate: get_current_user already rejects an inactive user on
    their very next request, rather than waiting for their access token
    to expire (contrast with suspension, which is enforced only at
    login/refresh -- see auth.py). See ADR-020.
    """
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant not found.", status_code=404)
    if tenant.status == "archived":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Tenant is already archived.", status_code=422)

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    company = db.execute(select(Company).where(Company.tenant_id == tenant.id)).scalars().first()
    if company is None:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Tenant has no company record -- refusing to archive without one.", status_code=422
        )

    backup = run_backup(db, tenant_id=tenant.id, company_id=company.id, user_id=None)
    if backup.status != "completed":
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Archive aborted: the pre-archive backup did not complete (status={backup.status}, error={backup.error_message}).",
            status_code=422,
        )

    db.execute(update(User).where(User.tenant_id == tenant.id).values(is_active=False))
    tenant.status = "archived"
    db.flush()

    return TenantArchiveResponse(tenant=_tenant_summary(db, tenant), backup_id=str(backup.id), backup_status=backup.status)


def _platform_ticket_out(db: Session, t: SupportTicket) -> PlatformSupportTicketOut:
    tenant = db.get(Tenant, t.tenant_id)
    return PlatformSupportTicketOut(
        id=str(t.id),
        subject=t.subject,
        status=t.status,
        priority=t.priority,
        created_at=t.created_at,
        updated_at=t.updated_at,
        tenant_id=str(t.tenant_id),
        tenant_name=tenant.name if tenant else "",
        tenant_slug=tenant.slug if tenant else "",
    )


def _platform_message_out(m: SupportTicketMessage) -> SupportMessageOut:
    return SupportMessageOut(
        id=str(m.id),
        body=m.body,
        author_user_id=str(m.author_user_id) if m.author_user_id else None,
        author_platform_admin_id=str(m.author_platform_admin_id) if m.author_platform_admin_id else None,
        created_at=m.created_at,
    )


@router.get("/support-tickets", response_model=list[PlatformSupportTicketOut])
def list_support_tickets(
    status: str | None = None,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> list[PlatformSupportTicketOut]:
    # get_platform_db sets app.platform_context=true, which the
    # tenant_isolation policy on these two tables (only) ORs into its
    # check -- a genuine cross-tenant read, not a per-tenant loop, is what
    # makes a real "all open tickets" inbox possible at all.
    stmt = select(SupportTicket)
    if status:
        stmt = stmt.where(SupportTicket.status == status)
    tickets = db.execute(stmt.order_by(SupportTicket.created_at.desc())).scalars().all()
    return [_platform_ticket_out(db, t) for t in tickets]


def _get_ticket_or_404(db: Session, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise AppError(ErrorCode.NOT_FOUND, "Support ticket not found.", status_code=404)
    return ticket


@router.get("/support-tickets/{ticket_id}", response_model=SupportTicketDetail)
def get_support_ticket(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> SupportTicketDetail:
    ticket = _get_ticket_or_404(db, ticket_id)
    messages = db.execute(
        select(SupportTicketMessage).where(SupportTicketMessage.ticket_id == ticket.id).order_by(SupportTicketMessage.created_at)
    ).scalars().all()
    platform_ticket = _platform_ticket_out(db, ticket)
    return SupportTicketDetail(**platform_ticket.model_dump(exclude={"tenant_id", "tenant_name", "tenant_slug"}), messages=[_platform_message_out(m) for m in messages])


@router.post("/support-tickets/{ticket_id}/messages", response_model=SupportMessageOut, status_code=201)
def reply_to_support_ticket(
    ticket_id: uuid.UUID,
    payload: SupportMessageCreate,
    db: Session = Depends(get_platform_db),
    admin: PlatformAdmin = Depends(get_platform_admin),
) -> SupportMessageOut:
    ticket = _get_ticket_or_404(db, ticket_id)
    message = SupportTicketMessage(
        tenant_id=ticket.tenant_id, ticket_id=ticket.id, body=payload.body, author_platform_admin_id=admin.id,
    )
    db.add(message)
    if ticket.status == "open":
        ticket.status = "in_progress"
    db.flush()
    return _platform_message_out(message)


@router.patch("/support-tickets/{ticket_id}", response_model=PlatformSupportTicketOut)
def update_support_ticket_status(
    ticket_id: uuid.UUID,
    payload: SupportTicketStatusUpdate,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> PlatformSupportTicketOut:
    if payload.status not in TICKET_STATUSES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"status must be one of {TICKET_STATUSES}.", status_code=422)
    ticket = _get_ticket_or_404(db, ticket_id)
    ticket.status = payload.status
    db.flush()
    return _platform_ticket_out(db, ticket)


def _platform_plan_out(db: Session, plan: Plan) -> PlatformPlanOut:
    feature_rows = db.execute(
        select(PlanFeature).where(PlanFeature.plan_id == plan.id, PlanFeature.is_enabled == True)  # noqa: E712
    ).scalars().all()
    codes = (
        [f.code for f in db.execute(select(Feature).where(Feature.id.in_([pf.feature_id for pf in feature_rows]))).scalars().all()]
        if feature_rows else []
    )
    limits = db.execute(select(PlanLimit).where(PlanLimit.plan_id == plan.id)).scalars().all()
    return PlatformPlanOut(
        id=plan.id, slug=plan.slug, version=plan.version, name=plan.name, description=plan.description,
        tier_order=plan.tier_order, is_public=plan.is_public, is_default_signup_plan=plan.is_default_signup_plan,
        currency=plan.currency, monthly_price=plan.monthly_price, yearly_price=plan.yearly_price,
        trial_days=plan.trial_days, features=codes, limits={pl.limit_key: pl.limit_value for pl in limits},
        is_current=plan.is_current, is_active=plan.is_active,
    )


@router.get("/plans", response_model=list[PlatformPlanOut])
def list_all_plan_versions(
    db: Session = Depends(get_platform_db), _admin: PlatformAdmin = Depends(get_platform_admin)
) -> list[PlatformPlanOut]:
    """Every version of every plan, unlike GET /pricing/plans (public,
    current-and-active only) -- an admin needs the full history to see
    what changed between versions."""
    plans = db.execute(select(Plan).order_by(Plan.slug, Plan.version.desc())).scalars().all()
    return [_platform_plan_out(db, p) for p in plans]


@router.get("/features", response_model=list[FeatureOut])
def list_all_features(
    db: Session = Depends(get_platform_db), _admin: PlatformAdmin = Depends(get_platform_admin)
) -> list[Feature]:
    return db.execute(select(Feature).order_by(Feature.category, Feature.name)).scalars().all()


@router.post("/plans", response_model=PlatformPlanOut, status_code=201)
def create_new_plan_version(
    payload: PlanVersionCreate,
    db: Session = Depends(get_platform_db),
    _admin: PlatformAdmin = Depends(get_platform_admin),
) -> PlatformPlanOut:
    """The only write endpoint plans ever get: always a new version, per
    create_plan_version's own docstring -- there is no PATCH/PUT here on
    purpose, since a live Plan row must never be mutated under an
    existing Subscription."""
    plan = create_plan_version(
        db, slug=payload.slug, name=payload.name, description=payload.description, tier_order=payload.tier_order,
        is_active=payload.is_active, is_public=payload.is_public, is_default_signup_plan=payload.is_default_signup_plan,
        currency=payload.currency, monthly_price=payload.monthly_price, yearly_price=payload.yearly_price,
        trial_days=payload.trial_days, feature_codes=payload.feature_codes, limits=payload.limits,
    )
    return _platform_plan_out(db, plan)


@router.get("/admins", response_model=list[PlatformAdminListOut])
def list_platform_admins(
    db: Session = Depends(get_platform_db), _admin: PlatformAdmin = Depends(get_platform_admin)
) -> list[PlatformAdminListOut]:
    admins = db.execute(select(PlatformAdmin).order_by(PlatformAdmin.created_at)).scalars().all()
    return [
        PlatformAdminListOut(
            id=str(a.id), email=a.email, full_name=a.full_name, is_active=a.is_active,
            created_by_admin_id=str(a.created_by_admin_id) if a.created_by_admin_id else None, created_at=a.created_at,
        )
        for a in admins
    ]


@router.post("/admins", response_model=PlatformAdminListOut, status_code=201)
def create_platform_admin_account(
    payload: PlatformAdminCreate,
    db: Session = Depends(get_platform_db),
    admin: PlatformAdmin = Depends(get_platform_admin),
) -> PlatformAdminListOut:
    """Gated by the acting admin re-entering their own current password
    (not the new admin's) -- the same "prove it's really you before a
    privilege-escalating action" pattern as, e.g., GitHub's sudo mode.
    This is the one privileged write in this whole file that a stolen-
    but-unused platform session token alone cannot perform.
    """
    if not verify_password(payload.acting_admin_password, admin.hashed_password):
        raise AppError(ErrorCode.UNAUTHORIZED, "Your password was incorrect.", status_code=401)

    existing = db.execute(select(PlatformAdmin).where(PlatformAdmin.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "An admin with this email already exists.", status_code=422)

    new_admin = PlatformAdmin(
        email=payload.email, full_name=payload.full_name, hashed_password=hash_password(payload.password),
        created_by_admin_id=admin.id,
    )
    db.add(new_admin)
    db.flush()
    return PlatformAdminListOut(
        id=str(new_admin.id), email=new_admin.email, full_name=new_admin.full_name, is_active=new_admin.is_active,
        created_by_admin_id=str(admin.id), created_at=new_admin.created_at,
    )
