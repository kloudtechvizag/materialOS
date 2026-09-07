import uuid
from collections.abc import Generator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, set_session_context
from app.errors import AppError, ErrorCode
from app.models.masters import Customer
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
