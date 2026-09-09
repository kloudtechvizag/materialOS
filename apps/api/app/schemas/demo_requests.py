import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class DemoRequestCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    company_name: str
    industry_slug: str | None = None
    message: str | None = None
    source_page: str | None = None


class DemoRequestOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True
