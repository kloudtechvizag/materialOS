"""B3: stock_balance is a materialised projection, always rebuildable from
stock_ledger. This function is both how we build it after the importer
commits and the nightly replay job that must find zero drift.

Also holds B4's reservation logic: a soft hold that lives in
stock_reservations, entirely separate from the ledger-derived
stock_balance, serialised per (warehouse_id, item_id) with a Postgres
advisory transaction lock rather than a SELECT ... FOR UPDATE, because
the thing being protected -- "sum of active reservations" -- isn't a
single row.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.catalog import Batch
from app.models.inventory import StockBalance, StockLedger, StockReservation


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


def apply_ledger_movement(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    item_id: uuid.UUID,
    qty: Decimal,  # signed: positive = stock in, negative = stock out
    rate: Decimal,
    movement_type: str,
    reference_type: str,
    reference_id: uuid.UUID,
    user_id: uuid.UUID,
    occurred_at: datetime | None = None,
) -> StockLedger:
    """The one path every stock movement goes through (opening, sale,
    transfer, adjustment, ...). Writes the immutable ledger row (B3) and
    incrementally maintains the stock_balance projection in the same
    transaction -- rebuild_stock_balance / assert_no_drift remain the
    correctness backstop, not the primary write path.
    """
    ledger_row = StockLedger(
        tenant_id=tenant_id,
        warehouse_id=warehouse_id,
        item_id=item_id,
        movement_type=movement_type,
        qty=qty,
        rate=rate,
        value=qty * rate,
        reference_type=reference_type,
        reference_id=reference_id,
        occurred_at=occurred_at or datetime.now(timezone.utc),
        created_by_user_id=user_id,
    )
    db.add(ledger_row)

    insert_stmt = pg_insert(StockBalance).values(
        tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=item_id, qty_on_hand=qty
    )
    upsert_stmt = insert_stmt.on_conflict_do_update(
        constraint="uq_stock_balance_warehouse_item",
        set_={"qty_on_hand": StockBalance.qty_on_hand + qty},
    )
    db.execute(upsert_stmt)
    db.flush()
    return ledger_row


def _advisory_lock(db: Session, warehouse_id: uuid.UUID, item_id: uuid.UUID) -> None:
    # hashtextextended gives a stable 64-bit key from the two UUIDs for
    # the duration of this transaction; released automatically on commit/rollback.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"{warehouse_id}:{item_id}"})


def reserve_stock(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    item_id: uuid.UUID,
    qty: Decimal,
    reference_type: str,
    reference_id: uuid.UUID,
) -> StockReservation:
    """B4: exactly one of two concurrent requests for the last unit of
    stock succeeds. The advisory lock serialises everything below it for
    this (warehouse_id, item_id) pair across the whole cluster, not just
    this row -- so the read-then-write here is safe despite not being a
    single atomic UPDATE.
    """
    _advisory_lock(db, warehouse_id, item_id)

    on_hand = db.execute(
        select(StockBalance.qty_on_hand).where(
            StockBalance.tenant_id == tenant_id,
            StockBalance.warehouse_id == warehouse_id,
            StockBalance.item_id == item_id,
        )
    ).scalar_one_or_none() or Decimal("0")

    reserved = db.execute(
        select(func.coalesce(func.sum(StockReservation.qty), 0)).where(
            StockReservation.tenant_id == tenant_id,
            StockReservation.warehouse_id == warehouse_id,
            StockReservation.item_id == item_id,
            StockReservation.status == "active",
        )
    ).scalar_one()

    available = on_hand - Decimal(reserved)
    if available < qty:
        raise AppError(
            ErrorCode.INSUFFICIENT_STOCK,
            f"Only {available} available; {qty} requested.",
            status_code=409,
            details={"available": str(available), "requested": str(qty)},
        )

    reservation = StockReservation(
        tenant_id=tenant_id,
        warehouse_id=warehouse_id,
        item_id=item_id,
        qty=qty,
        status="active",
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(reservation)
    db.flush()
    return reservation


def release_reservations(db: Session, *, reference_type: str, reference_id: uuid.UUID) -> None:
    reservations = db.execute(
        select(StockReservation).where(
            StockReservation.reference_type == reference_type,
            StockReservation.reference_id == reference_id,
            StockReservation.status == "active",
        )
    ).scalars().all()
    for r in reservations:
        r.status = "released"


def fulfill_reservation(
    db: Session, *, reference_type: str, reference_id: uuid.UUID, item_id: uuid.UUID, qty: Decimal
) -> None:
    """Marks (fully or partially) an active reservation fulfilled. Called
    at dispatch, alongside the apply_ledger_movement() call that actually
    moves the stock -- the reservation itself never touches the ledger.
    """
    reservation = db.execute(
        select(StockReservation).where(
            StockReservation.reference_type == reference_type,
            StockReservation.reference_id == reference_id,
            StockReservation.item_id == item_id,
            StockReservation.status == "active",
        )
    ).scalar_one_or_none()
    if reservation is None:
        return
    if qty >= reservation.qty:
        reservation.status = "fulfilled"
    else:
        reservation.qty -= qty
        db.flush()
        db.add(
            StockReservation(
                tenant_id=reservation.tenant_id,
                warehouse_id=reservation.warehouse_id,
                item_id=reservation.item_id,
                qty=qty,
                status="fulfilled",
                reference_type=reference_type,
                reference_id=reference_id,
            )
        )


def near_expiry_batches(db: Session, *, tenant_id: uuid.UUID, days: int = 60) -> list[Batch]:
    """Pharmacy profile (ADR-010): batches expiring within `days`, oldest
    first. Read-only -- Batch is not yet a dimension of stock_ledger/
    stock_balance (no goods-receipt or sale flow assigns stock to a
    specific batch today), so this reports on batch records that exist,
    it does not yet drive FEFO picking at the ledger level. That
    remains backlog until something actually writes batch-scoped stock
    movements to pick from."""
    cutoff = date.today() + timedelta(days=days)
    return db.execute(
        select(Batch)
        .where(Batch.tenant_id == tenant_id, Batch.expiry_date.is_not(None), Batch.expiry_date <= cutoff)
        .order_by(Batch.expiry_date.asc())
    ).scalars().all()
