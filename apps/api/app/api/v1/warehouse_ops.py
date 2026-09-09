import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.tenant import Branch, Company
from app.models.user import User
from app.models.warehouse_ops import SalesReturn, StockCount, StockTransfer
from app.schemas.warehouse_ops import (
    SalesReturnCreate,
    SalesReturnOut,
    StockCountCreate,
    StockCountOut,
    StockCountSubmit,
    TransferCreate,
    TransferOut,
)
from app.services.numbering import get_current_financial_year
from app.services.sales_return import create_sales_return
from app.services.stock_count import approve_stock_count, start_stock_count, submit_stock_count
from app.services.transfers import create_transfer, dispatch_transfer, receive_transfer

router = APIRouter(tags=["warehouse-ops"])


def _default_company_and_branch(db: Session, tenant_id: uuid.UUID) -> tuple[Company, Branch]:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    return company, branch


# ---------------------------------------------------------------- Transfers

@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("stock.view"))) -> list[StockTransfer]:
    return db.execute(select(StockTransfer).order_by(StockTransfer.created_at.desc())).scalars().all()


@router.post("/transfers", response_model=TransferOut, status_code=201)
def create_transfer_endpoint(
    payload: TransferCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("stock.create")),
) -> StockTransfer:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    return create_transfer(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        from_warehouse_id=payload.from_warehouse_id, to_warehouse_id=payload.to_warehouse_id,
        lines=[line.model_dump() for line in payload.lines],
    )


@router.post("/transfers/{transfer_id}/dispatch", response_model=TransferOut)
def dispatch_transfer_endpoint(
    transfer_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("stock.edit")),
) -> StockTransfer:
    return dispatch_transfer(db, tenant_id=user.tenant_id, transfer_id=transfer_id, user_id=user.id)


@router.post("/transfers/{transfer_id}/receive", response_model=TransferOut)
def receive_transfer_endpoint(
    transfer_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("stock.edit")),
) -> StockTransfer:
    return receive_transfer(db, tenant_id=user.tenant_id, transfer_id=transfer_id, user_id=user.id)


# ---------------------------------------------------------------- Stock counts

@router.get("/stock-counts", response_model=list[StockCountOut])
def list_stock_counts(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("stock.view"))) -> list[StockCount]:
    return db.execute(select(StockCount).order_by(StockCount.created_at.desc())).scalars().all()


@router.get("/stock-counts/{count_id}", response_model=StockCountOut)
def get_stock_count(count_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("stock.view"))) -> StockCount:
    count = db.get(StockCount, count_id)
    if count is None:
        raise AppError(ErrorCode.NOT_FOUND, "Stock count not found.", status_code=404)
    return count


@router.post("/stock-counts", response_model=StockCountOut, status_code=201)
def create_stock_count_endpoint(
    payload: StockCountCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("stock.create")),
) -> StockCount:
    return start_stock_count(
        db, tenant_id=user.tenant_id, warehouse_id=payload.warehouse_id, item_ids=payload.item_ids, counted_by_user_id=user.id,
    )


@router.post("/stock-counts/{count_id}/submit", response_model=StockCountOut)
def submit_stock_count_endpoint(
    count_id: uuid.UUID, payload: StockCountSubmit, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("stock.edit")),
) -> StockCount:
    return submit_stock_count(db, count_id=count_id, counted_quantities=payload.counted_quantities)


@router.post("/stock-counts/{count_id}/approve", response_model=StockCountOut)
def approve_stock_count_endpoint(
    count_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("stock.approve")),
) -> StockCount:
    return approve_stock_count(db, tenant_id=user.tenant_id, count_id=count_id, approved_by_user_id=user.id)


# ---------------------------------------------------------------- Sales returns

@router.get("/sales-returns", response_model=list[SalesReturnOut])
def list_sales_returns(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))) -> list[SalesReturn]:
    return db.execute(select(SalesReturn).order_by(SalesReturn.created_at.desc())).scalars().all()


@router.post("/sales-returns", response_model=SalesReturnOut, status_code=201)
def create_sales_return_endpoint(
    payload: SalesReturnCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("customers.edit")),
) -> SalesReturn:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    return create_sales_return(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        invoice_id=payload.invoice_id, warehouse_id=payload.warehouse_id, reason=payload.reason,
        lines=[line.model_dump() for line in payload.lines], user_id=user.id,
    )


@router.get("/sales-returns/{return_id}", response_model=SalesReturnOut)
def get_sales_return(
    return_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view")),
) -> SalesReturn:
    sales_return = db.get(SalesReturn, return_id)
    if sales_return is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sales return not found.", status_code=404)
    return sales_return
