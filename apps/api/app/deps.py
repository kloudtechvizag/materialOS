import uuid
from collections.abc import Generator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, set_platform_context, set_session_context
from app.errors import AppError, ErrorCode
from app.models.education import Guardian
from app.models.industry import IndustryProfile
from app.models.masters import Customer
from app.models.platform_admin import PlatformAdmin
from app.models.tenant import Company
from app.models.user import Permission, RolePermission, User, UserRole
from app.security import decode_token


def get_db_tenant(authorization: str | None = Header(default=None)) -> Generator[Session, None, None]:
    """Decodes the bearer token, opens a session, and sets the Postgres
    session GUCs (app.current_tenant, app.current_user) that RLS policies
    (B9) and the audit trigger (B12) key off -- all inside one transaction
    so SET LOCAL stays in effect for every query the request makes.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(ErrorCode.UNAUTHORIZED, "Missing or malformed Authorization header.", status_code=401)

    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired token.", status_code=401) from exc

    if payload.get("type") != "access":
        raise AppError(ErrorCode.UNAUTHORIZED, "Token is not an access token.", status_code=401)

    db = SessionLocal()
    try:
        set_session_context(db, tenant_id=payload["tenant_id"], user_id=payload["sub"])
        db.info["tenant_id"] = uuid.UUID(payload["tenant_id"])
        db.info["user_id"] = uuid.UUID(payload["sub"])
        # Only create_impersonation_token ever sets this claim (ADR-020) --
        # stashed here so /auth/me can surface it without re-decoding the
        # token, which is how the tenant-facing UI knows to show its
        # "you are being impersonated" banner.
        db.info["impersonated_by"] = payload.get("impersonated_by")
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_current_user(db: Session = Depends(get_db_tenant)) -> User:
    user_id = db.info["user_id"]
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(ErrorCode.UNAUTHORIZED, "User not found or inactive.", status_code=401)
    return user


def require_permission(permission_code: str):
    def _check(
        db: Session = Depends(get_db_tenant),
        user: User = Depends(get_current_user),
    ) -> User:
        stmt = (
            select(RolePermission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(UserRole.user_id == user.id)
            .where(Permission.code == permission_code)
        )
        granted = db.execute(stmt).first() is not None
        if not granted:
            raise AppError(
                ErrorCode.FORBIDDEN,
                f"Missing permission: {permission_code}.",
                status_code=403,
                details={"permission": permission_code},
            )
        return user

    return _check


def user_permission_codes(db: Session, user_id: uuid.UUID) -> set[str]:
    """All permission codes a user holds, in one query -- for a caller
    that needs to honestly show/hide several independent sections of
    one response by real permission (e.g. the School Dashboard), not
    just gate a single endpoint the way `require_permission` does."""
    stmt = (
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    )
    return set(db.execute(stmt).scalars().all())


def require_module(module_key: str):
    """RBAC (require_permission) only proves a role was granted a
    permission -- it has no idea what the tenant's active industry
    profile is. Industry-exclusive permission resources (currently
    "laboratory", "printing") were backfilled onto every existing
    tenant's owner role when they were introduced (see e.g. migration
    b8c9d0e1f2a3), so without this check, any tenant's owner can call
    another industry's API by URL alone, even though the UI never
    shows them the nav link. This closes that gap: the tenant's
    Company -> IndustryProfile.enabled_modules must actually list
    module_key, on top of (not instead of) the normal permission check.
    A tenant with no company or no industry profile configured yet is
    treated as having zero modules enabled -- deny, not allow, matching
    the "unconfigured profile shows nothing" default elsewhere in the
    platform.
    """

    def _check(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> User:
        company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
        profile = db.get(IndustryProfile, company.industry_profile_id) if company and company.industry_profile_id else None
        enabled_modules = profile.enabled_modules if profile else []
        if module_key not in enabled_modules:
            raise AppError(
                ErrorCode.FORBIDDEN,
                f"The '{module_key}' module is not enabled for this business.",
                status_code=403,
                details={"module": module_key},
            )
        return user

    return _check


def get_platform_db() -> Generator[Session, None, None]:
    """No tenant context is ever set on this session -- RLS-protected
    tables return zero rows here by design (see db.get_db's own
    docstring). Only platform-root tables (Tenant, PlatformAdmin, Plan,
    IndustryProfile, ...) are safely readable through it as-is; reading
    anything tenant-scoped (e.g. a Company name) needs an explicit,
    one-tenant-at-a-time set_session_context call, the same pattern
    billing_tasks.py's daily job already uses to loop every active
    tenant. Also sets app.platform_context=true -- support_tickets/
    support_ticket_messages are the only two tables whose RLS policy
    checks that GUC at all, so setting it unconditionally here has zero
    effect on every other tenant-scoped table's isolation. See ADR-020.
    """
    db = SessionLocal()
    try:
        set_platform_context(db, enabled=True)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_platform_admin(authorization: str | None = Header(default=None), db: Session = Depends(get_platform_db)) -> PlatformAdmin:
    """Mirrors get_current_user's shape but for the platform-admin console
    -- deliberately a fully separate dependency (own token type, own
    table, own session helper) rather than a variant of the tenant-user
    path, so there's no code path where a tenant user's token could ever
    be accepted here or vice versa."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(ErrorCode.UNAUTHORIZED, "Missing or malformed Authorization header.", status_code=401)

    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired token.", status_code=401) from exc

    if payload.get("type") != "platform":
        raise AppError(ErrorCode.UNAUTHORIZED, "Token is not a platform admin token.", status_code=401)

    admin = db.get(PlatformAdmin, uuid.UUID(payload["sub"]))
    if admin is None or not admin.is_active:
        raise AppError(ErrorCode.UNAUTHORIZED, "Platform admin not found or inactive.", status_code=401)
    return admin


def get_portal_customer(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> Customer:
    """Every /portal/* endpoint depends on this, never on require_permission
    alone -- it scopes to exactly one customer, regardless of what RBAC
    permissions the "customer" role happens to carry (see ADR-009).
    """
    if user.customer_id is None:
        raise AppError(ErrorCode.FORBIDDEN, "This login is not a customer-portal account.", status_code=403)
    customer = db.get(Customer, user.customer_id)
    if customer is None:
        raise AppError(ErrorCode.NOT_FOUND, "Customer not found.", status_code=404)
    return customer


def get_portal_guardian(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> Guardian:
    """Every /guardian-portal/* endpoint depends on this, never on
    require_permission alone -- it scopes to exactly one guardian,
    regardless of what RBAC permissions the "guardian" role happens to
    carry (same reasoning as get_portal_customer / ADR-009, applied to
    ADR-032's Guardian Portal).
    """
    if user.guardian_id is None:
        raise AppError(ErrorCode.FORBIDDEN, "This login is not a guardian-portal account.", status_code=403)
    guardian = db.get(Guardian, user.guardian_id)
    if guardian is None:
        raise AppError(ErrorCode.NOT_FOUND, "Guardian not found.", status_code=404)
    return guardian
