import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import DeliveryChallan, DeliveryChallanItem, SalesOrder, SalesOrderItem
from app.services.inventory import apply_ledger_movement, fulfill_reservation
from app.services.numbering import next_document_number


def create_delivery_challan(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    sales_order_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    user_id: uuid.UUID,
) -> DeliveryChallan:
    order = db.get(SalesOrder, sales_order_id)
    items = db.execute(
        select(SalesOrderItem).where(SalesOrderItem.sales_order_id == sales_order_id)
    ).scalars().all()

    number = next_document_number(
        db,
        company_id=order.company_id,
        branch_id=order.branch_id,
        financial_year_id=financial_year_id,
        doc_type="DC",
        default_prefix="DC",
    )

    challan = DeliveryChallan(
        tenant_id=tenant_id,
        number=number,
        company_id=order.company_id,
        branch_id=order.branch_id,
        sales_order_id=order.id,
        warehouse_id=order.warehouse_id,
        dispatch_date=date.today(),
        status="dispatched",
    )
    db.add(challan)
    db.flush()

    for soi in items:
        pending = soi.qty - soi.qty_dispatched
        if pending <= 0:
            continue

        db.add(
            DeliveryChallanItem(
                tenant_id=tenant_id,
                delivery_challan_id=challan.id,
                sales_order_item_id=soi.id,
                item_id=soi.item_id,
                qty=pending,
            )
        )

        # The physical movement (B3) and the reservation state change
        # (B4) happen together, in the same transaction, at dispatch --
        # not at invoicing, which is purely a billing event here.
        apply_ledger_movement(
            db,
            tenant_id=tenant_id,
            warehouse_id=order.warehouse_id,
            item_id=soi.item_id,
            qty=-pending,
            rate=soi.rate,
            movement_type="dispatch",
            reference_type="delivery_challan",
            reference_id=challan.id,
            user_id=user_id,
        )
        fulfill_reservation(
            db, reference_type="sales_order", reference_id=order.id, item_id=soi.item_id, qty=pending
        )
        soi.qty_dispatched += pending

    order.status = "dispatched"
    db.flush()
    return challan
