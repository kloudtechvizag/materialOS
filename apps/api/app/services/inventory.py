"""B3: stock_balance is a materialised projection, always rebuildable from
stock_ledger. This function is both how we build it after the importer
commits and the nightly replay job that must find zero drift.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.inventory import StockBalance, StockLedger


def rebuild_stock_balance(db: Session, *, tenant_id: uuid.UUID) -> int:
    totals = db.execute(
        select(
            StockLedger.warehouse_id,
            StockLedger.item_id,
            func.sum(StockLedger.qty).label("qty_on_hand"),
        )
        .where(StockLedger.tenant_id == tenant_id)
        .group_by(StockLedger.warehouse_id, StockLedger.item_id)
    ).all()

    db.query(StockBalance).filter(StockBalance.tenant_id == tenant_id).delete()

    rows = 0
    for warehouse_id, item_id, qty_on_hand in totals:
        db.execute(
            pg_insert(StockBalance).values(
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
                item_id=item_id,
                qty_on_hand=qty_on_hand or Decimal("0"),
            )
        )
        rows += 1
    db.flush()
    return rows


def assert_no_drift(db: Session, *, tenant_id: uuid.UUID) -> None:
    """Raises if stock_balance disagrees with a fresh replay of
    stock_ledger. Intended for the nightly job (B3's mandatory test).
    """
    ledger_rows = db.execute(
        select(
            StockLedger.warehouse_id,
            StockLedger.item_id,
            func.sum(StockLedger.qty),
        )
        .where(StockLedger.tenant_id == tenant_id)
        .group_by(StockLedger.warehouse_id, StockLedger.item_id)
    ).all()
    ledger_keyed = {(w, i): q for w, i, q in ledger_rows}

    balance_rows = db.execute(
        select(StockBalance.warehouse_id, StockBalance.item_id, StockBalance.qty_on_hand).where(
            StockBalance.tenant_id == tenant_id
        )
    ).all()
    balance_totals = {(w, i): q for w, i, q in balance_rows}

    if ledger_keyed != balance_totals:
        raise AssertionError(
            f"stock_balance drift detected for tenant {tenant_id}: "
            f"ledger={ledger_keyed} balance={balance_totals}"
        )
