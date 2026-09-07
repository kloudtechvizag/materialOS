from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.schemas.collections import AgeingLineOut, DsoOut
from app.services.collections import ageing_report, collection_priority, compute_dso

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/ageing", response_model=list[AgeingLineOut])
def get_ageing(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list:
    return ageing_report(db)


@router.get("/priority", response_model=list[AgeingLineOut])
def get_priority(
    limit: int = 20, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list:
    return collection_priority(db, limit=limit)


@router.get("/dso", response_model=DsoOut)
def get_dso(
    period_days: int = 60, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> dict:
    return {"period_days": period_days, "dso": compute_dso(db, period_days=period_days)}
