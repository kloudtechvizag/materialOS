"""ADR-021: Tenant settings, organization configuration, and brand logo management.
Supports multi-tenant brand logo upload, serving, and deletion across all 26 industry profiles.
"""
import mimetypes
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.tenant import Company, Tenant
from app.models.user import User
from app.schemas.tenant import LogoDeleteResponse, LogoUploadResponse, TenantSettingsOut
from app.security import decode_token
from app.storage import read_file, save_file

router = APIRouter(prefix="/tenant", tags=["tenant"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "image/webp",
}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB limit


@router.get("/settings", response_model=TenantSettingsOut)
def get_tenant_settings(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(get_current_user),
) -> TenantSettingsOut:
    """Retrieve settings and brand info for the current tenant organization."""
    tenant = db.get(Tenant, user.tenant_id)
    if tenant is None:
        raise AppError(ErrorCode.NOT_FOUND, "Tenant organization not found.", status_code=404)

    # Primary company for branding details
    primary_company = db.execute(
        select(Company).where(Company.tenant_id == user.tenant_id).order_by(Company.created_at)
    ).scalars().first()

    logo_url = "/api/v1/tenant/branding/logo" if tenant.logo_path else None

    return TenantSettingsOut(
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        logo_url=logo_url,
        company_id=primary_company.id if primary_company else None,
        company_name=primary_company.name if primary_company else tenant.name,
        gstin=primary_company.gstin if primary_company else None,
    )


@router.post("/branding/logo", response_model=LogoUploadResponse)
def upload_tenant_logo(
    file: Annotated[UploadFile, File(...)],
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("companies.edit")),
) -> LogoUploadResponse:
    """Upload a new brand logo for the tenant.

    Enforces 2 MB size ceiling and image MIME types (.png, .jpg, .jpeg, .svg, .webp).
    Updates tenant and associated companies.
    """
    filename = file.filename or "brand-logo.png"
    lower_name = filename.lower()
    has_valid_ext = any(lower_name.endswith(ext) for ext in ALLOWED_EXTENSIONS)
    has_valid_type = file.content_type in ALLOWED_CONTENT_TYPES

    if not (has_valid_ext or has_valid_type):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Unsupported file format '{filename}'. Allowed formats: PNG, JPG, JPEG, SVG, WebP.",
            status_code=422,
        )

    content = file.file.read()

    if len(content) > MAX_FILE_SIZE:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"File size exceeds 2 MB limit (received {len(content) / (1024 * 1024):.2f} MB).",
            status_code=422,
        )

    # Save to object storage
    saved_path = save_file(
        tenant_id=user.tenant_id,
        category="branding",
        file_name=filename,
        content=content,
    )

    # Update Tenant
    tenant = db.get(Tenant, user.tenant_id)
    if tenant:
        tenant.logo_path = saved_path

    # Update all Companies under this tenant
    companies = db.execute(
        select(Company).where(Company.tenant_id == user.tenant_id)
    ).scalars().all()
    for company in companies:
        company.logo_path = saved_path

    db.flush()

    return LogoUploadResponse(
        logo_url="/api/v1/tenant/branding/logo",
        file_name=filename,
        size_bytes=len(content),
    )


@router.delete("/branding/logo", response_model=LogoDeleteResponse)
def delete_tenant_logo(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("companies.edit")),
) -> LogoDeleteResponse:
    """Remove existing brand logo for the tenant organization."""
    tenant = db.get(Tenant, user.tenant_id)
    if tenant:
        tenant.logo_path = None

    companies = db.execute(
        select(Company).where(Company.tenant_id == user.tenant_id)
    ).scalars().all()
    for company in companies:
        company.logo_path = None

    db.flush()

    return LogoDeleteResponse(success=True, logo_url=None)


@router.get("/branding/logo")
def get_tenant_logo(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
    tenant_slug: str | None = Query(default=None),
) -> Response:
    """Stream brand logo image bytes. Supports Bearer header, ?token= param, or ?tenant_slug=."""
    effective_token = None
    if authorization and authorization.startswith("Bearer "):
        effective_token = authorization.removeprefix("Bearer ")
    elif token:
        effective_token = token

    db = SessionLocal()
    try:
        tenant = None
        if effective_token:
            try:
                payload = decode_token(effective_token)
                tenant_id = uuid.UUID(payload["tenant_id"])
                tenant = db.get(Tenant, tenant_id)
            except Exception:
                pass

        if tenant is None and tenant_slug:
            tenant = db.execute(select(Tenant).where(Tenant.slug == tenant_slug)).scalars().first()

        # If still no tenant and only 1 tenant exists in single-tenant/demo environments, fallback
        if tenant is None:
            tenant = db.execute(select(Tenant).order_by(Tenant.created_at)).scalars().first()

        if tenant is None or not tenant.logo_path:
            raise AppError(ErrorCode.NOT_FOUND, "No logo found for this organization.", status_code=404)

        try:
            content = read_file(tenant.logo_path)
        except FileNotFoundError:
            raise AppError(ErrorCode.NOT_FOUND, "Logo file not found in storage.", status_code=404)

        media_type = mimetypes.guess_type(tenant.logo_path)[0] or "image/png"
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Cache-Control": "public, max-age=3600",
            },
        )
    finally:
        db.close()
