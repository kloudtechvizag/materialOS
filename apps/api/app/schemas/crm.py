import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.customer import CustomerOut


class LeadOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID | None
    name: str
    company_name: str | None
    phone: str | None
    email: str | None
    source: str | None
    status: str
    estimated_value: Decimal | None
    notes: str | None
    lost_reason: str | None
    assigned_to_user_id: uuid.UUID | None
    converted_customer_id: uuid.UUID | None

    class Config:
        from_attributes = True


class LeadCreate(BaseModel):
    name: str
    company_name: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    estimated_value: Decimal | None = None
    notes: str | None = None
    branch_id: uuid.UUID | None = None
    assigned_to_user_id: uuid.UUID | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    status: str | None = None
    estimated_value: Decimal | None = None
    notes: str | None = None
    lost_reason: str | None = None
    branch_id: uuid.UUID | None = None
    assigned_to_user_id: uuid.UUID | None = None


class LeadConvertRequest(BaseModel):
    billing_state: str | None = None
    credit_limit: Decimal | None = None
    credit_days: int | None = None


class LeadConvertResult(BaseModel):
    lead: LeadOut
    customer: CustomerOut
