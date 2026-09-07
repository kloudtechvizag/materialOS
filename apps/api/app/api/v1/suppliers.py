import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.masters import Supplier
from app.models.procurement import PurchaseBill, PurchaseOrder
from app.models.user import User
from app.schemas.procurement import Supplier360, SupplierCreate, SupplierOut
from app.services.supplier_credit import compute_payable

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("", response_model=list[SupplierOut])
def list_suppliers(
    q: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view")),
) -> list[Supplier]:
    stmt = select(Supplier).where(Supplier.is_active.is_(True)).order_by(Supplier.name).limit(200)
    if q:
        stmt = stmt.where(Supplier.name.ilike(f"%{q}%"))
    return db.execute(stmt).scalars().all()


@router.post("", response_model=SupplierOut, status_code=201)
def create_supplier(
    payload: SupplierCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.create")),
) -> Supplier:
    from app.models.tenant import Company

    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    supplier = Supplier(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(supplier)
    db.flush()
    return supplier


@router.get("/{supplier_id}/360", response_model=Supplier360)
def supplier_360(
    supplier_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view")),
) -> dict:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise AppError(ErrorCode.NOT_FOUND, "Supplier not found.", status_code=404)

    payable = compute_payable(db, supplier_id)
    open_pos = db.execute(
        select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.supplier_id == supplier_id, PurchaseOrder.status.notin_(["received", "cancelled"])
        )
    ).scalar_one()
    posted_bills = db.execute(
        select(func.count()).select_from(PurchaseBill).where(PurchaseBill.supplier_id == supplier_id, PurchaseBill.status == "posted")
    ).scalar_one()

    return {"supplier": supplier, "payable": payable, "open_purchase_orders": open_pos, "posted_bills": posted_bills}
