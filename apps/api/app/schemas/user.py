import uuid

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    phone: str | None = None
    role_names: list[str] = []
    branch_id: uuid.UUID | None = None


class RoleOut(BaseModel):
    id: uuid.UUID
    name: str
    is_system: bool

    class Config:
        from_attributes = True
