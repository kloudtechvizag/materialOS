from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.tenant import TenantSignupRequest, TenantSignupResponse
from app.services.tenant_signup import signup_tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/signup", response_model=TenantSignupResponse, status_code=201)
def signup(req: TenantSignupRequest, db: Session = Depends(get_db)) -> TenantSignupResponse:
    result = signup_tenant(db, req)
    return TenantSignupResponse(**result)
