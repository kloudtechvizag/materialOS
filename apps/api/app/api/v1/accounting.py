import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.accounting import Account, CostCenter
from app.models.tenant import Company
from app.models.user import User
from app.schemas.accounting import (
    AccountCreate,
    AccountOut,
    BalanceSheetOut,
    CashFlowOut,
    CostCenterCreate,
    CostCenterOut,
    GeneralLedgerLineOut,
    ProfitAndLossOut,
    TrialBalanceLineOut,
)
from app.services.accounting_reports import balance_sheet, cash_flow, general_ledger, profit_and_loss, trial_balance

router = APIRouter(tags=["accounting"])


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))) -> list[Account]:
    return db.execute(select(Account).where(Account.is_active.is_(True)).order_by(Account.code)).scalars().all()


@router.post("/accounts", response_model=AccountOut, status_code=201)
def create_account(
    payload: AccountCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("companies.edit")),
) -> Account:
    company = _default_company(db, user.tenant_id)
    account = Account(tenant_id=user.tenant_id, company_id=company.id, is_system=False, **payload.model_dump())
    db.add(account)
    db.flush()
    return account


@router.delete("/accounts/{account_id}", status_code=204)
def deactivate_account(
    account_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.edit")),
) -> None:
    account = db.get(Account, account_id)
    if account is None:
        raise AppError(ErrorCode.NOT_FOUND, "Account not found.", status_code=404)
    if account.is_system:
        raise AppError(ErrorCode.VALIDATION_ERROR, "System accounts cannot be deactivated.")
    account.is_active = False


@router.get("/cost-centers", response_model=list[CostCenterOut])
def list_cost_centers(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))) -> list[CostCenter]:
    return db.execute(select(CostCenter).where(CostCenter.is_active.is_(True)).order_by(CostCenter.name)).scalars().all()


@router.post("/cost-centers", response_model=CostCenterOut, status_code=201)
def create_cost_center(
    payload: CostCenterCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("companies.edit")),
) -> CostCenter:
    center = CostCenter(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(center)
    db.flush()
    return center


@router.get("/reports/trial-balance", response_model=list[TrialBalanceLineOut])
def get_trial_balance(
    as_of: date | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view")),
) -> list:
    return trial_balance(db, as_of=as_of or date.today())


@router.get("/reports/general-ledger/{account_id}", response_model=list[GeneralLedgerLineOut])
def get_general_ledger(
    account_id: uuid.UUID, from_date: date, to_date: date,
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view")),
) -> list:
    return general_ledger(db, account_id=account_id, from_date=from_date, to_date=to_date)


@router.get("/reports/profit-and-loss", response_model=ProfitAndLossOut)
def get_profit_and_loss(
    from_date: date, to_date: date, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view")),
):
    return profit_and_loss(db, from_date=from_date, to_date=to_date)


@router.get("/reports/balance-sheet", response_model=BalanceSheetOut)
def get_balance_sheet(
    as_of: date | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view")),
):
    return balance_sheet(db, as_of=as_of or date.today())


@router.get("/reports/cash-flow", response_model=CashFlowOut)
def get_cash_flow(
    from_date: date, to_date: date, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view")),
):
    return cash_flow(db, from_date=from_date, to_date=to_date)
