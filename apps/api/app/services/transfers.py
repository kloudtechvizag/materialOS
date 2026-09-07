import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.masters import Item
from app.models.warehouse_ops import StockTransfer, StockTransferItem
from app.services.inventory import apply_ledger_movement
from app.services.numbering import next_document_number


def create_transfer(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, financial_year_id: uuid.UUID,
    from_warehouse_id: uuid.UUID, to_warehouse_id: uuid.UUID, lines: list[dict],
) -> StockTransfer:
    if from_warehouse_id == to_warehouse_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Source and destination warehouse must differ.")

    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="TRF", default_prefix="TRF",
    )
    transfer = StockTransfer(
        tenant_id=tenant_id, number=number, from_warehouse_id=from_warehouse_id, to_warehouse_id=to_warehouse_id,
        transfer_date=date.today(), status="requested",
    )
    db.add(transfer)
    db.flush()

    for line in lines:
        db.add(
            StockTransferItem(
                tenant_id=tenant_id, stock_transfer_id=transfer.id, item_id=line["item_id"], qty=Decimal(str(line["qty"])),
            )
        )
    db.flush()
    return transfer


def dispatch_transfer(db: Session, *, tenant_id: uuid.UUID, transfer_id: uuid.UUID, user_id: uuid.UUID) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if transfer is None:
        raise AppError(ErrorCode.NOT_FOUND, "Transfer not found.", status_code=404)
    if transfer.status != "requested":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a requested transfer can be dispatched.")

    lines = db.execute(select(StockTransferItem).where(StockTransferItem.stock_transfer_id == transfer.id)).scalars().all()
    for line in lines:
        item = db.get(Item, line.item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=transfer.from_warehouse_id, item_id=line.item_id,
            qty=-line.qty, rate=item.standard_cost, movement_type="transfer_out",
            reference_type="stock_transfer", reference_id=transfer.id, user_id=user_id,
        )
    transfer.status = "dispatched"
    db.flush()
    return transfer


def receive_transfer(db: Session, *, tenant_id: uuid.UUID, transfer_id: uuid.UUID, user_id: uuid.UUID) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if transfer is None:
        raise AppError(ErrorCode.NOT_FOUND, "Transfer not found.", status_code=404)
    if transfer.status != "dispatched":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a dispatched transfer can be received.")

    lines = db.execute(select(StockTransferItem).where(StockTransferItem.stock_transfer_id == transfer.id)).scalars().all()
    for line in lines:
        item = db.get(Item, line.item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=transfer.to_warehouse_id, item_id=line.item_id,
            qty=line.qty, rate=item.standard_cost, movement_type="transfer_in",
            reference_type="stock_transfer", reference_id=transfer.id, user_id=user_id,
        )
    transfer.status = "received"
    db.flush()
    return transfer
