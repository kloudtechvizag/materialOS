"""Minimal chart-of-accounts bootstrap (see ADR in Account's docstring
-- full CoA management is Slice 4). Just enough system accounts for
Invoice/Receipt to post a balanced journal.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.accounting import Account

SYSTEM_ACCOUNTS = [
    ("1100-AR", "Accounts Receivable", "asset"),
    ("1000-CASH", "Cash", "asset"),
    ("1010-BANK", "Bank", "asset"),
    ("4000-SALES", "Sales", "income"),
    ("2100-OUTPUT-CGST", "Output CGST", "liability"),
    ("2110-OUTPUT-SGST", "Output SGST", "liability"),
    ("2120-OUTPUT-IGST", "Output IGST", "liability"),
    ("4900-ROUNDOFF", "Round Off", "income"),
    ("2000-AP", "Accounts Payable", "liability"),
    ("5000-PURCHASES", "Purchases", "expense"),
    ("1300-INPUT-CGST", "Input CGST", "asset"),
    ("1310-INPUT-SGST", "Input SGST", "asset"),
    ("1320-INPUT-IGST", "Input IGST", "asset"),
]


def ensure_default_accounts(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> dict[str, Account]:
    existing = {
        a.code: a
        for a in db.execute(
            select(Account).where(Account.tenant_id == tenant_id, Account.company_id == company_id)
        ).scalars()
    }
    for code, name, account_type in SYSTEM_ACCOUNTS:
        if code not in existing:
            account = Account(tenant_id=tenant_id, company_id=company_id, code=code, name=name, account_type=account_type)
            db.add(account)
            db.flush()
            existing[code] = account
    return existing


def get_account(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, code: str) -> Account:
    return ensure_default_accounts(db, tenant_id=tenant_id, company_id=company_id)[code]
