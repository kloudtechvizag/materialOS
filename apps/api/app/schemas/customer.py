import uuid
from decimal import Decimal

from pydantic import BaseModel


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    gstin: str | None
    phone: str | None
    email: str | None
    billing_state: str | None
    credit_limit: Decimal
    credit_days: int
    is_active: bool

    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    name: str
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    billing_state: str | None = None
    credit_limit: Decimal = Decimal("0")
    credit_days: int = 0


class Customer360(BaseModel):
    customer: CustomerOut
    outstanding: Decimal
    available_credit: Decimal
    open_quotations: int
    open_sales_orders: int
    posted_invoices: int


class PortalAccessCreate(BaseModel):
    email: str
    password: str
    full_name: str


class PortalAccessOut(BaseModel):
    user_id: uuid.UUID
    email: str
    customer_id: uuid.UUID
