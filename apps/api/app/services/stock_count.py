"""dev.md §18: select warehouse -> scan/count -> submit -> variance
calculated -> manager approval -> adjustment posted. Approval is the
only step that touches the ledger -- everything before it is a draft,
consistent with B3 (stock is derived, corrections are new entries).
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.inventory import StockBalance
from app.models.masters import Item
from app.models.warehouse_ops import StockCount, StockCountItem
from app.services.inventory import apply_ledger_movement


def start_stock_count(
    db: Session, *, tenant_id: uuid.UUID, warehouse_id: uuid.UUID, item_ids: list[uuid.UUID], counted_by_user_id: uuid.UUID,
) -> StockCount:
    count = StockCount(
        tenant_id=tenant_id, warehouse_id=warehouse_id, count_date=date.today(),
        status="draft", counted_by_user_id=counted_by_user_id,
    )
    db.add(count)
    db.flush()

    for item_id in item_ids:
        system_qty = db.execute(
            select(StockBalance.qty_on_hand).where(
                StockBalance.tenant_id == tenant_id, StockBalance.warehouse_id == warehouse_id, StockBalance.item_id == item_id,
            )
        ).scalar_one_or_none() or Decimal("0")
        db.add(
            StockCountItem(tenant_id=tenant_id, stock_count_id=count.id, item_id=item_id, system_qty=system_qty, counted_qty=system_qty)
        )
    db.flush()
    return count


def submit_stock_count(db: Session, *, count_id: uuid.UUID, counted_quantities: dict[str, Decimal]) -> StockCount:
    count = db.get(StockCount, count_id)
    if count is None:
        raise AppError(ErrorCode.NOT_FOUND, "Stock count not found.", status_code=404)
    if count.status != "draft":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a draft count can be submitted.")

    lines = db.execute(select(StockCountItem).where(StockCountItem.stock_count_id == count_id)).scalars().all()
    for line in lines:
        if str(line.item_id) in counted_quantities:
            line.counted_qty = Decimal(str(counted_quantities[str(line.item_id)]))

    count.status = "submitted"
    db.flush()
    return count


def approve_stock_count(db: Session, *, tenant_id: uuid.UUID, count_id: uuid.UUID, approved_by_user_id: uuid.UUID) -> StockCount:
    count = db.get(StockCount, count_id)
    if count is None:
        raise AppError(ErrorCode.NOT_FOUND, "Stock count not found.", status_code=404)
    if count.status != "submitted":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a submitted count can be approved.")

    lines = db.execute(select(StockCountItem).where(StockCountItem.stock_count_id == count_id)).scalars().all()
    for line in lines:
        variance = line.counted_qty - line.system_qty
        if variance == 0:
            continue
        item = db.get(Item, line.item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=count.warehouse_id, item_id=line.item_id,
            qty=variance, rate=item.standard_cost, movement_type="adjustment",
            reference_type="stock_count", reference_id=count.id, user_id=approved_by_user_id,
        )

    count.status = "approved"
    count.approved_by_user_id = approved_by_user_id
    db.flush()
    return count
