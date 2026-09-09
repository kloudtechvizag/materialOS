import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.masters import Supplier
from app.models.procurement import PurchaseBill, PurchaseOrder
from app.models.user import User
from app.schemas.procurement import Supplier360, SupplierCreate, SupplierOut, SupplierUpdate, SuppliersSummary
from app.services.supplier_credit import compute_payable, compute_payable_bulk

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _open_po_counts_by_supplier(db: Session, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
    return dict(
        db.execute(
            select(PurchaseOrder.supplier_id, func.count())
            .where(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.status.notin_(["received", "cancelled"]))
            .group_by(PurchaseOrder.supplier_id)
        ).all()
    )


@router.get("", response_model=list[SupplierOut])
def list_suppliers(
    q: str | None = None, include_inactive: bool = False,
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.view")),
) -> list[Supplier]:
    # Default (active-only) is what a purchase-order supplier picker wants;
    # the suppliers management page passes include_inactive=true so a
    # deactivated supplier doesn't just vanish with no way back.
    stmt = select(Supplier).order_by(Supplier.name).limit(200)
    if not include_inactive:
        stmt = stmt.where(Supplier.is_active.is_(True))
    if q:
        stmt = stmt.where(
            Supplier.name.ilike(f"%{q}%") | Supplier.gstin.ilike(f"%{q}%") | Supplier.phone.ilike(f"%{q}%")
        )
    suppliers = db.execute(stmt).scalars().all()

    payable_by_supplier = compute_payable_bulk(db, user.tenant_id)
    open_po_by_supplier = _open_po_counts_by_supplier(db, user.tenant_id)
    for supplier in suppliers:
        supplier.outstanding_balance = payable_by_supplier.get(supplier.id, 0)
        supplier.open_purchase_orders = open_po_by_supplier.get(supplier.id, 0)
    return suppliers


@router.get("/summary", response_model=SuppliersSummary)
def suppliers_summary(
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.view")),
) -> dict:
    total_suppliers = db.execute(
        select(func.count()).select_from(Supplier).where(Supplier.tenant_id == user.tenant_id, Supplier.is_active.is_(True))
    ).scalar_one()

    active_purchase_orders = db.execute(
        select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.tenant_id == user.tenant_id, PurchaseOrder.status.notin_(["received", "cancelled"])
        )
    ).scalar_one()

    total_outstanding = sum(compute_payable_bulk(db, user.tenant_id).values(), Decimal(0))

    missing_gstin_count = db.execute(
        select(func.count()).select_from(Supplier).where(
            Supplier.tenant_id == user.tenant_id, Supplier.is_active.is_(True), Supplier.gstin.is_(None)
        )
    ).scalar_one()

    return {
        "total_suppliers": total_suppliers,
        "active_purchase_orders": active_purchase_orders,
        "total_outstanding": total_outstanding,
        "missing_gstin_count": missing_gstin_count,
    }


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


@router.patch("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: uuid.UUID, payload: SupplierUpdate, db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("suppliers.edit")),
) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise AppError(ErrorCode.NOT_FOUND, "Supplier not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
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
