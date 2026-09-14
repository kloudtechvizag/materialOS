from datetime import datetime

from pydantic import BaseModel, EmailStr


class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str


class PlatformTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PlatformAdminOut(BaseModel):
    id: str
    email: str
    full_name: str


class TenantSummary(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    created_at: datetime
    company_name: str | None = None
    user_count: int
    plan_name: str | None = None
    subscription_status: str | None = None


class TenantDetail(TenantSummary):
    active_features: list[str]


class TenantStatusUpdate(BaseModel):
    status: str


class TenantListResponse(BaseModel):
    tenants: list[TenantSummary]
    total: int
    page: int
    page_size: int


class TenantArchiveResponse(BaseModel):
    tenant: TenantSummary
    backup_id: str
    backup_status: str


class TenantUserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool


class ImpersonationTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_slug: str
    user_email: str
    expires_in_minutes: int = 15


class PlatformAdminListOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    created_by_admin_id: str | None
    created_at: datetime


class PlatformAdminCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    # The ACTING admin's own current password, re-entered -- not
    # confirmation of the new admin's password. This is the gate: only
    # someone who can currently authenticate as an existing admin can
    # vouch for a new one.
    acting_admin_password: str
