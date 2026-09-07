from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.field_sales import Visit
from app.models.user import User
from app.schemas.field_sales import VisitCreate, VisitOut
from app.services.visits import check_in

router = APIRouter(prefix="/visits", tags=["field-sales"])


@router.get("", response_model=list[VisitOut])
def list_visits(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list[Visit]:
    return db.execute(select(Visit).order_by(Visit.checked_in_at.desc()).limit(100)).scalars().all()


@router.post("", response_model=VisitOut, status_code=201)
def create_visit(
    payload: VisitCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("customers.create")),
) -> Visit:
    return check_in(
        db, tenant_id=user.tenant_id, customer_id=payload.customer_id, salesperson_user_id=user.id,
        latitude=payload.latitude, longitude=payload.longitude, purpose=payload.purpose, notes=payload.notes,
    )
