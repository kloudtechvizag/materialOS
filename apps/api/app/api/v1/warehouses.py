from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.tenant import Warehouse
from app.schemas.tenant import WarehouseCreate, WarehouseOut

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseOut])
def list_warehouses(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("warehouses.view")),
) -> list[Warehouse]:
    return db.execute(select(Warehouse).order_by(Warehouse.created_at)).scalars().all()


@router.post("", response_model=WarehouseOut, status_code=201)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db_tenant),
    user=Depends(require_permission("warehouses.create")),
) -> Warehouse:
    warehouse = Warehouse(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(warehouse)
    db.flush()
    return warehouse
