import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, set_session_context
from app.deps import get_current_user, get_db_tenant
from app.errors import AppError, ErrorCode
from app.models.tenant import Tenant
from app.models.user import Role, User, UserRole
from app.schemas.auth import CurrentUserResponse, LoginRequest, RefreshRequest, TokenResponse
from app.security import create_access_token, create_refresh_token, decode_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    tenant = db.execute(select(Tenant).where(Tenant.slug == req.tenant_slug)).scalar_one_or_none()
    if tenant is None:
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid tenant, email, or password.", status_code=401)

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    user = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(req.password, user.hashed_password):
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid tenant, email, or password.", status_code=401)

    return TokenResponse(
        access_token=create_access_token(user_id=user.id, tenant_id=tenant.id),
        refresh_token=create_refresh_token(user_id=user.id, tenant_id=tenant.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest) -> TokenResponse:
    try:
        payload = decode_token(req.refresh_token)
    except ValueError as exc:
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired refresh token.", status_code=401) from exc
    if payload.get("type") != "refresh":
        raise AppError(ErrorCode.UNAUTHORIZED, "Token is not a refresh token.", status_code=401)

    user_id = uuid.UUID(payload["sub"])
    tenant_id = uuid.UUID(payload["tenant_id"])
    return TokenResponse(
        access_token=create_access_token(user_id=user_id, tenant_id=tenant_id),
        refresh_token=create_refresh_token(user_id=user_id, tenant_id=tenant_id),
    )


@router.get("/me", response_model=CurrentUserResponse)
def me(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> CurrentUserResponse:
    roles = db.execute(
        select(Role.name).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user.id)
    ).scalars().all()
    return CurrentUserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tenant_id=str(user.tenant_id),
        roles=list(roles),
        customer_id=str(user.customer_id) if user.customer_id else None,
    )
