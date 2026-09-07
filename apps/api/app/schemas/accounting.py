import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class AccountOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    account_type: str
    parent_account_id: uuid.UUID | None
    is_system: bool
    is_active: bool

    class Config:
        from_attributes = True


class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    parent_account_id: uuid.UUID | None = None


class CostCenterOut(BaseModel):
    id: uuid.UUID
    name: str
    center_type: str
    is_active: bool

    class Config:
        from_attributes = True


class CostCenterCreate(BaseModel):
    name: str
    center_type: str


class TrialBalanceLineOut(BaseModel):
    account_id: uuid.UUID
    account_code: str
    account_name: str
    account_type: str
    debit: Decimal
    credit: Decimal


class GeneralLedgerLineOut(BaseModel):
    entry_date: date
    document_type: str
    document_id: uuid.UUID
    narration: str | None
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class ProfitAndLossOut(BaseModel):
    income_by_account: list[tuple[str, str, Decimal]]
    expense_by_account: list[tuple[str, str, Decimal]]
    total_income: Decimal
    total_expense: Decimal
    net_profit: Decimal


class BalanceSheetOut(BaseModel):
    assets_by_account: list[tuple[str, str, Decimal]]
    liabilities_by_account: list[tuple[str, str, Decimal]]
    total_assets: Decimal
    total_liabilities: Decimal
    retained_earnings: Decimal


class CashFlowLineOut(BaseModel):
    document_type: str
    net_amount: Decimal


class CashFlowOut(BaseModel):
    opening_balance: Decimal
    by_document_type: list[CashFlowLineOut]
    closing_balance: Decimal
