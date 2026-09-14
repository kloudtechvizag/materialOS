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
