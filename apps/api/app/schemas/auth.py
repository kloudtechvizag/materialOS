from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    tenant_slug: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    tenant_id: str
    roles: list[str]
    customer_id: str | None = None
