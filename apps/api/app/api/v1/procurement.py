import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.procurement import GoodsReceipt, PurchaseBill, PurchaseOrder, PurchaseReturn, SupplierPayment
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.procurement import (
    GoodsReceiptCreate,
    GoodsReceiptOut,
    LandedCostCreate,
    PurchaseBillOut,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseReturnCreate,
    PurchaseReturnOut,
    SupplierPaymentCreate,
    SupplierPaymentOut,
)
from app.services.numbering import get_current_financial_year
from app.services.procurement import (
    allocate_landed_cost,
    approve_purchase_order,
    create_purchase_bill,
    create_purchase_order,
    receive_goods,
    record_supplier_payment,
)
from app.services.purchase_return import create_purchase_return

router = APIRouter(tags=["procurement"])


def _default_company_and_branch(db: Session, tenant_id: uuid.UUID) -> tuple[Company, Branch]:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    return company, branch


@router.get("/purchase-orders", response_model=list[PurchaseOrderOut])
def list_purchase_orders(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> list[PurchaseOrder]:
    return db.execute(select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())).scalars().all()


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderOut)
def get_purchase_order(order_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> PurchaseOrder:
    order = db.get(PurchaseOrder, order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase order not found.", status_code=404)
    return order


@router.post("/purchase-orders", response_model=PurchaseOrderOut, status_code=201)
def create_purchase_order_endpoint(
    payload: PurchaseOrderCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.create")),
) -> PurchaseOrder:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    order = create_purchase_order(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, warehouse_id=payload.warehouse_id,
        supplier_id=payload.supplier_id, financial_year_id=fy.id, lines=[line.model_dump() for line in payload.lines],
    )
    db.refresh(order)
    return order


@router.post("/purchase-orders/{order_id}/approve", response_model=PurchaseOrderOut)
def approve_purchase_order_endpoint(order_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.edit"))) -> PurchaseOrder:
    return approve_purchase_order(db, purchase_order_id=order_id)


@router.post("/purchase-orders/{order_id}/receive", response_model=GoodsReceiptOut)
def receive_goods_endpoint(
    order_id: uuid.UUID, payload: GoodsReceiptCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.edit")),
) -> GoodsReceipt:
    order = db.get(PurchaseOrder, order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase order not found.", status_code=404)
    fy = get_current_financial_year(db, order.company_id)
    receipt = receive_goods(
        db, tenant_id=user.tenant_id, purchase_order_id=order_id, financial_year_id=fy.id,
        lines=[line.model_dump() for line in payload.lines], user_id=user.id,
    )
    db.refresh(receipt)
    return receipt


@router.get("/goods-receipts/{receipt_id}", response_model=GoodsReceiptOut)
def get_goods_receipt(receipt_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> GoodsReceipt:
    receipt = db.get(GoodsReceipt, receipt_id)
    if receipt is None:
        raise AppError(ErrorCode.NOT_FOUND, "Goods receipt not found.", status_code=404)
    return receipt


@router.post("/goods-receipts/{receipt_id}/landed-cost", response_model=GoodsReceiptOut)
def add_landed_cost(
    receipt_id: uuid.UUID, payload: LandedCostCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.edit")),
) -> GoodsReceipt:
    receipt = allocate_landed_cost(
        db, tenant_id=user.tenant_id, goods_receipt_id=receipt_id, cost_type=payload.cost_type,
        amount=payload.amount, allocation_method=payload.allocation_method,
    )
    db.refresh(receipt)
    return receipt


@router.post("/goods-receipts/{receipt_id}/bill", response_model=PurchaseBillOut)
def create_bill_endpoint(receipt_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.edit"))) -> PurchaseBill:
    receipt = db.get(GoodsReceipt, receipt_id)
    if receipt is None:
        raise AppError(ErrorCode.NOT_FOUND, "Goods receipt not found.", status_code=404)
    fy = get_current_financial_year(db, receipt.company_id)
    bill = create_purchase_bill(db, tenant_id=user.tenant_id, financial_year_id=fy.id, goods_receipt_id=receipt_id)
    db.refresh(bill)
    return bill


@router.get("/purchase-bills", response_model=list[PurchaseBillOut])
def list_purchase_bills(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> list[PurchaseBill]:
    return db.execute(select(PurchaseBill).order_by(PurchaseBill.created_at.desc())).scalars().all()


@router.get("/purchase-bills/{bill_id}", response_model=PurchaseBillOut)
def get_purchase_bill(bill_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> PurchaseBill:
    bill = db.get(PurchaseBill, bill_id)
    if bill is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase bill not found.", status_code=404)
    return bill


@router.post("/supplier-payments", response_model=SupplierPaymentOut, status_code=201)
def create_supplier_payment_endpoint(
    payload: SupplierPaymentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.edit")),
) -> SupplierPayment:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    return record_supplier_payment(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        supplier_id=payload.supplier_id, amount=payload.amount, mode=payload.mode, purchase_bill_id=payload.purchase_bill_id,
    )


@router.get("/supplier-payments", response_model=list[SupplierPaymentOut])
def list_supplier_payments(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("suppliers.view"))) -> list[SupplierPayment]:
    return db.execute(select(SupplierPayment).order_by(SupplierPayment.created_at.desc())).scalars().all()


# --------------------------------------------------------- Purchase returns (debit notes)

@router.post("/purchase-returns", response_model=PurchaseReturnOut, status_code=201)
def create_purchase_return_endpoint(
    payload: PurchaseReturnCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("suppliers.edit")),
) -> PurchaseReturn:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    return create_purchase_return(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        purchase_bill_id=payload.purchase_bill_id, warehouse_id=payload.warehouse_id, reason=payload.reason,
        lines=[line.model_dump() for line in payload.lines], user_id=user.id,
    )


@router.get("/purchase-returns", response_model=list[PurchaseReturnOut])
def list_purchase_returns(
    db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("suppliers.view")),
) -> list[PurchaseReturn]:
    return db.execute(select(PurchaseReturn).order_by(PurchaseReturn.created_at.desc()).limit(200)).scalars().all()


@router.get("/purchase-returns/{return_id}", response_model=PurchaseReturnOut)
def get_purchase_return(
    return_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("suppliers.view")),
) -> PurchaseReturn:
    purchase_return = db.get(PurchaseReturn, return_id)
    if purchase_return is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase return not found.", status_code=404)
    return purchase_return
