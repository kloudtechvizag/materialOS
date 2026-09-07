import uuid
from datetime import date

from pydantic import BaseModel


class SiteOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    city: str | None
    state: str
    gstin: str | None

    class Config:
        from_attributes = True


class SiteCreate(BaseModel):
    name: str
    address_line1: str | None = None
    city: str | None = None
    state: str
    pincode: str | None = None
    gstin: str | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    name: str
    project_manager: str | None
    contractor: str | None
    architect: str | None
    expected_completion: date | None
    status: str
    sites: list[SiteOut] = []

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    customer_id: uuid.UUID
    name: str
    project_manager: str | None = None
    contractor: str | None = None
    architect: str | None = None
    expected_completion: date | None = None
    sites: list[SiteCreate] = []


class ProjectProfitability(BaseModel):
    project_id: uuid.UUID
    revenue: str
    cost: str
    profit: str
    margin_percent: str
