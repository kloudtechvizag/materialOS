import uuid

from pydantic import BaseModel, EmailStr


class TenantSignupRequest(BaseModel):
    tenant_name: str
    tenant_slug: str
    company_name: str
    company_legal_name: str
    owner_full_name: str
    owner_email: EmailStr
    owner_password: str


class TenantSignupResponse(BaseModel):
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID
    warehouse_id: uuid.UUID
    user_id: uuid.UUID


class CompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    legal_name: str
    gstin: str | None
    financial_year_start_month: int

    class Config:
        from_attributes = True


class BranchOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    code: str
    gstin: str | None
    is_active: bool

    class Config:
        from_attributes = True


class BranchCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    code: str
    gstin: str | None = None
    city: str | None = None
    state: str | None = None


class WarehouseOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    code: str
    is_active: bool

    class Config:
        from_attributes = True
