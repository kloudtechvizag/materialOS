from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.masters import Customer, Item
from app.models.sales import Invoice, Quotation, SalesOrder
from app.services.credit import compute_outstanding

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> dict:
    """dev.md §9/§115: "How is my business doing?" answered on load, not
    with a spinner per widget -- Slice 1 has just enough real data for
    this to mean something (outstanding, open pipeline, catalog size).
    """
    customer_ids = db.execute(select(Customer.id).where(Customer.is_active.is_(True))).scalars().all()
    total_outstanding = sum((compute_outstanding(db, cid) for cid in customer_ids), start=0)

    open_quotations = db.execute(
        select(func.count()).select_from(Quotation).where(Quotation.status.in_(["draft", "sent", "approved"]))
    ).scalar_one()
    open_sales_orders = db.execute(
        select(func.count()).select_from(SalesOrder).where(SalesOrder.status.notin_(["invoiced", "cancelled"]))
    ).scalar_one()
    posted_invoices = db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.status == "posted")
    ).scalar_one()
    invoiced_total = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.status == "posted")
    ).scalar_one()
    active_items = db.execute(
        select(func.count()).select_from(Item).where(Item.is_active.is_(True))
    ).scalar_one()
    active_customers = len(customer_ids)

    return {
        "total_outstanding": str(total_outstanding),
        "total_invoiced": str(invoiced_total),
        "open_quotations": open_quotations,
        "open_sales_orders": open_sales_orders,
        "posted_invoices": posted_invoices,
        "active_items": active_items,
        "active_customers": active_customers,
    }
