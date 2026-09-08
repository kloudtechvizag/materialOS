import uuid

from pydantic import BaseModel, EmailStr

from app.schemas.industry import IndustryProfileOut


class TenantSignupRequest(BaseModel):
    tenant_name: str
    tenant_slug: str
    company_name: str
    company_legal_name: str
    company_state: str | None = None  # home state -- drives CGST/SGST vs IGST (D3)
    company_city: str | None = None
    owner_full_name: str
    owner_email: EmailStr
    owner_password: str
    # Defaults to the flagship profile so existing signup flows/tests that
    # don't know about industries yet keep working unchanged.
    industry_slug: str = "building_materials"


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
    state: str | None
    financial_year_start_month: int
    e_invoice_enabled: bool
    e_way_bill_enabled: bool
    industry_profile: IndustryProfileOut | None

    class Config:
        from_attributes = True


class CompanyComplianceUpdate(BaseModel):
    e_invoice_enabled: bool | None = None
    e_way_bill_enabled: bool | None = None


class CompanyIndustryUpdate(BaseModel):
    industry_slug: str


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
