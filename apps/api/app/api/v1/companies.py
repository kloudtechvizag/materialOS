from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.tenant import Company
from app.schemas.tenant import CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("companies.view")),
) -> list[Company]:
    return db.execute(select(Company).order_by(Company.created_at)).scalars().all()
