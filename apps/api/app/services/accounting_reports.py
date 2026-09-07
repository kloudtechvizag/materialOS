"""dev.md §38/§60: general ledger, trial balance, P&L, balance sheet,
cash flow -- all computed by reading JournalLine, never a second
maintained total that could drift from it (same principle as B3's
"stock is derived, never stored as truth").

Slice 4's acceptance test is literally "the trial balance ties" --
trial_balance() summing to zero net (debits == credits) is the thing
that test checks.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounting import Account, JournalEntry, JournalLine


@dataclass
class TrialBalanceLine:
    account_id: uuid.UUID
    account_code: str
    account_name: str
    account_type: str
    debit: Decimal
    credit: Decimal


def trial_balance(db: Session, *, as_of: date) -> list[TrialBalanceLine]:
    rows = db.execute(
        select(
            Account.id, Account.code, Account.name, Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), 0), func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalEntry.entry_date <= as_of)
        .group_by(Account.id, Account.code, Account.name, Account.account_type)
        .order_by(Account.code)
    ).all()

    return [
        TrialBalanceLine(account_id=r[0], account_code=r[1], account_name=r[2], account_type=r[3], debit=Decimal(r[4]), credit=Decimal(r[5]))
        for r in rows
        if Decimal(r[4]) != 0 or Decimal(r[5]) != 0
    ]


@dataclass
class GeneralLedgerLine:
    entry_date: date
    document_type: str
    document_id: uuid.UUID
    narration: str | None
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


def general_ledger(db: Session, *, account_id: uuid.UUID, from_date: date, to_date: date) -> list[GeneralLedgerLine]:
    opening = db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit), 0) - func.coalesce(func.sum(JournalLine.credit), 0)
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalLine.account_id == account_id, JournalEntry.entry_date < from_date)
    ).scalar_one()
    balance = Decimal(opening)

    rows = db.execute(
        select(JournalEntry.entry_date, JournalEntry.document_type, JournalEntry.document_id, JournalEntry.narration, JournalLine.debit, JournalLine.credit)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalLine.account_id == account_id, JournalEntry.entry_date >= from_date, JournalEntry.entry_date <= to_date)
        .order_by(JournalEntry.entry_date, JournalEntry.created_at)
    ).all()

    lines = []
    for entry_date, doc_type, doc_id, narration, debit, credit in rows:
        balance += Decimal(debit) - Decimal(credit)
        lines.append(
            GeneralLedgerLine(entry_date=entry_date, document_type=doc_type, document_id=doc_id, narration=narration, debit=Decimal(debit), credit=Decimal(credit), running_balance=balance)
        )
    return lines


@dataclass
class ProfitAndLoss:
    income_by_account: list[tuple[str, str, Decimal]]  # (code, name, amount)
    expense_by_account: list[tuple[str, str, Decimal]]
    total_income: Decimal
    total_expense: Decimal
    net_profit: Decimal


def profit_and_loss(db: Session, *, from_date: date, to_date: date) -> ProfitAndLoss:
    rows = db.execute(
        select(Account.code, Account.name, Account.account_type, func.coalesce(func.sum(JournalLine.credit - JournalLine.debit), 0))
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalEntry.entry_date >= from_date, JournalEntry.entry_date <= to_date, Account.account_type.in_(["income", "expense"]))
        .group_by(Account.code, Account.name, Account.account_type)
        .order_by(Account.code)
    ).all()

    income = [(c, n, Decimal(amt)) for c, n, t, amt in rows if t == "income" and Decimal(amt) != 0]
    # Expense accounts carry a natural debit balance -- credit-debit above is negative for them; flip sign for display.
    expense = [(c, n, -Decimal(amt)) for c, n, t, amt in rows if t == "expense" and Decimal(amt) != 0]

    total_income = sum((amt for _, _, amt in income), Decimal("0"))
    total_expense = sum((amt for _, _, amt in expense), Decimal("0"))
    return ProfitAndLoss(income_by_account=income, expense_by_account=expense, total_income=total_income, total_expense=total_expense, net_profit=total_income - total_expense)


@dataclass
class BalanceSheet:
    assets_by_account: list[tuple[str, str, Decimal]]
    liabilities_by_account: list[tuple[str, str, Decimal]]
    total_assets: Decimal
    total_liabilities: Decimal
    retained_earnings: Decimal  # computed plug: assets - liabilities, not a posted equity account (see ADR-008)


def balance_sheet(db: Session, *, as_of: date) -> BalanceSheet:
    rows = db.execute(
        select(Account.code, Account.name, Account.account_type, func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0))
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalEntry.entry_date <= as_of, Account.account_type.in_(["asset", "liability"]))
        .group_by(Account.code, Account.name, Account.account_type)
        .order_by(Account.code)
    ).all()

    assets = [(c, n, Decimal(amt)) for c, n, t, amt in rows if t == "asset" and Decimal(amt) != 0]
    # Liability accounts carry a natural credit balance -- debit-credit above is negative; flip for display.
    liabilities = [(c, n, -Decimal(amt)) for c, n, t, amt in rows if t == "liability" and Decimal(amt) != 0]

    total_assets = sum((amt for _, _, amt in assets), Decimal("0"))
    total_liabilities = sum((amt for _, _, amt in liabilities), Decimal("0"))
    return BalanceSheet(
        assets_by_account=assets, liabilities_by_account=liabilities,
        total_assets=total_assets, total_liabilities=total_liabilities,
        retained_earnings=total_assets - total_liabilities,
    )


@dataclass
class CashFlowLine:
    document_type: str
    net_amount: Decimal  # positive = cash in, negative = cash out


@dataclass
class CashFlowStatement:
    opening_balance: Decimal
    by_document_type: list[CashFlowLine]
    closing_balance: Decimal


CASH_AND_BANK_CODES = ("1000-CASH", "1010-BANK")


def cash_flow(db: Session, *, from_date: date, to_date: date) -> CashFlowStatement:
    """Direct-method, cash-basis. Every posting this system makes today
    is an operating activity (no fixed-asset purchases or financing
    transactions are modeled yet) -- so this is not labelled "operating
    activities" the way a full indirect-method statement would, since
    that would imply investing/financing sections exist and are simply
    empty, when really they are not modeled at all. See ADR-008.
    """
    cash_accounts = db.execute(select(Account.id).where(Account.code.in_(CASH_AND_BANK_CODES))).scalars().all()

    opening = db.execute(
        select(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0))
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalLine.account_id.in_(cash_accounts), JournalEntry.entry_date < from_date)
    ).scalar_one()

    rows = db.execute(
        select(JournalEntry.document_type, func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0))
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(JournalLine.account_id.in_(cash_accounts), JournalEntry.entry_date >= from_date, JournalEntry.entry_date <= to_date)
        .group_by(JournalEntry.document_type)
    ).all()

    by_type = [CashFlowLine(document_type=t, net_amount=Decimal(amt)) for t, amt in rows]
    period_net = sum((line.net_amount for line in by_type), Decimal("0"))
    return CashFlowStatement(opening_balance=Decimal(opening), by_document_type=by_type, closing_balance=Decimal(opening) + period_net)
