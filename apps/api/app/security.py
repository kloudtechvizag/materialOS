import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(*, subject: uuid.UUID, tenant_id: uuid.UUID, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: uuid.UUID, tenant_id: uuid.UUID) -> str:
    return create_token(
        subject=user_id,
        tenant_id=tenant_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(*, user_id: uuid.UUID, tenant_id: uuid.UUID) -> str:
    return create_token(
        subject=user_id,
        tenant_id=tenant_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("invalid token") from exc


def create_impersonation_token(*, user_id: uuid.UUID, tenant_id: uuid.UUID, admin_id: uuid.UUID) -> str:
    """A real access token (RLS/get_db_tenant treat it exactly like one --
    same `type: access`, same tenant_id claim) plus one extra claim,
    `impersonated_by`, that a normal access token never carries. That
    claim is what /auth/me surfaces so the tenant-facing UI can show a
    persistent "you are being impersonated" banner (ADR-020), and it's
    deliberately much shorter-lived than a normal session (15 minutes,
    not settings.access_token_expire_minutes) since it grants a platform
    admin real access to a tenant's own account."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "type": "access",
        "impersonated_by": str(admin_id),
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_platform_admin_token(*, admin_id: uuid.UUID) -> str:
    """Deliberately has no tenant_id claim at all -- unlike create_token,
    not just a different `type` value. get_db_tenant requires tenant_id to
    be present to set the RLS session GUC, so a platform token literally
    cannot be mistaken for or misused as a tenant access token even if
    someone forgot to check `type`. See ADR-020."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(admin_id),
        "type": "platform",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
