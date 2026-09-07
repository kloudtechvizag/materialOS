import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Quotation, QuotationItem, SalesOrder, SalesOrderItem
from app.services.approvals import check_credit_with_approval
from app.services.inventory import reserve_stock
from app.services.numbering import next_document_number


def create_sales_order_from_quotation(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    quotation_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    requested_by_user_id: uuid.UUID,
) -> SalesOrder:
    quotation = db.get(Quotation, quotation_id)
    items = db.execute(
        select(QuotationItem).where(QuotationItem.quotation_id == quotation_id)
    ).scalars().all()

    # B25/credit check runs before a single row of the order is created --
    # a rejection here must leave nothing behind (B6). ADR-009: a block
    # also opens a pending ApprovalRequest; an approved one lets a retry
    # through without re-blocking.
    check_credit_with_approval(
        db, tenant_id=tenant_id, customer_id=quotation.customer_id, additional_amount=quotation.total,
        document_type="quotation", document_id=quotation_id, requested_by_user_id=requested_by_user_id,
    )

    number = next_document_number(
        db,
        company_id=quotation.company_id,
        branch_id=quotation.branch_id,
        financial_year_id=financial_year_id,
        doc_type="SO",
        default_prefix="SO",
    )

    order = SalesOrder(
        tenant_id=tenant_id,
        number=number,
        company_id=quotation.company_id,
        branch_id=quotation.branch_id,
        warehouse_id=warehouse_id,
        customer_id=quotation.customer_id,
        project_id=quotation.project_id,
        site_id=quotation.site_id,
        quotation_id=quotation.id,
        order_date=date.today(),
        status="draft",
        subtotal=quotation.subtotal,
        tax_total=quotation.tax_total,
        total=quotation.total,
    )
    db.add(order)
    db.flush()

    for qi in items:
        db.add(
            SalesOrderItem(
                tenant_id=tenant_id,
                sales_order_id=order.id,
                item_id=qi.item_id,
                qty=qi.qty,
                uom=qi.uom,
                rate=qi.rate,
                gst_rate=qi.gst_rate,
                line_subtotal=qi.line_subtotal,
                line_tax=qi.line_tax,
                line_total=qi.line_total,
            )
        )
        # B4: race-safe reservation. Raises INSUFFICIENT_STOCK, which
        # rolls back the whole order in the same transaction if any one
        # line can't be reserved -- no partial orders.
        reserve_stock(
            db,
            tenant_id=tenant_id,
            warehouse_id=warehouse_id,
            item_id=qi.item_id,
            qty=qi.qty,
            reference_type="sales_order",
            reference_id=order.id,
        )

    order.status = "reserved"
    quotation.status = "converted"
    db.flush()
    return order
