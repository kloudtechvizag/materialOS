from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.inventory import StockBalance
from app.models.masters import Customer, Item
from app.models.pos import WalkInSale
from app.models.printing import PrintJob
from app.models.sales import Invoice, Quotation, SalesOrder
from app.services.collections import collection_priority
from app.services.credit import compute_outstanding
from app.services.inventory import near_expiry_batches
from app.services.printing import PRODUCTION_STATUSES

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db_tenant),
    user=Depends(require_permission("customers.view")),
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

    # Retail profile widgets (todays_sales, cash_upi_split) -- harmless
    # for Building Materials since its dashboard_widgets never reference
    # these keys.
    today = date.today()
    todays_sales = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0))
        .where(Invoice.invoice_date == today, Invoice.status == "posted")
    ).scalar_one()
    todays_cash, todays_upi, todays_card = db.execute(
        select(
            func.coalesce(func.sum(WalkInSale.cash_amount), 0),
            func.coalesce(func.sum(WalkInSale.upi_amount), 0),
            func.coalesce(func.sum(WalkInSale.card_amount), 0),
        )
        .join(Invoice, Invoice.id == WalkInSale.invoice_id)
        .where(Invoice.invoice_date == today)
    ).one()
    near_expiry_count = len(near_expiry_batches(db, tenant_id=user.tenant_id, days=60))

    # Warehouse-based trading profiles' "Inventory value" KPI (dashboard
    # redesign) -- stock on hand priced at standard cost, the same figure
    # a physical stock count would value the warehouse at. Real join
    # against StockBalance (the materialised qty-on-hand projection,
    # services.inventory.rebuild_stock_balance), not a new table.
    inventory_value = db.execute(
        select(func.coalesce(func.sum(StockBalance.qty_on_hand * Item.standard_cost), 0))
        .join(Item, Item.id == StockBalance.item_id)
    ).scalar_one()

    # Reuses collections.py's own overdue-invoice rule (amount due,
    # days_overdue > 0) rather than re-deriving it -- the "Receivables"
    # KPI's status hint, not a new endpoint.
    has_overdue_receivables = len(collection_priority(db)) > 0

    # Printing profile widgets (sec23/45) -- harmless for every other
    # profile since none of them reference these dashboard_widgets keys.
    open_job_statuses = list(PRODUCTION_STATUSES) + [
        "draft", "quoted", "approved", "artwork_pending", "prepress",
        "rework", "ready_for_pickup", "dispatched",
    ]
    jobs_due_today = db.execute(
        select(func.count()).select_from(PrintJob).where(PrintJob.due_date == today, PrintJob.status.in_(open_job_statuses))
    ).scalar_one()
    jobs_overdue = db.execute(
        select(func.count()).select_from(PrintJob).where(PrintJob.due_date < today, PrintJob.status.in_(open_job_statuses))
    ).scalar_one()
    jobs_in_production = db.execute(
        select(func.count()).select_from(PrintJob).where(PrintJob.status.in_(PRODUCTION_STATUSES))
    ).scalar_one()

    return {
        "total_outstanding": str(total_outstanding),
        "total_invoiced": str(invoiced_total),
        "open_quotations": open_quotations,
        "open_sales_orders": open_sales_orders,
        "posted_invoices": posted_invoices,
        "active_items": active_items,
        "active_customers": active_customers,
        "todays_sales": str(todays_sales),
        "todays_cash": str(todays_cash),
        "todays_upi": str(todays_upi),
        "todays_card": str(todays_card),
        "near_expiry_count": near_expiry_count,
        "jobs_due_today": jobs_due_today,
        "jobs_overdue": jobs_overdue,
        "jobs_in_production": jobs_in_production,
        "inventory_value": str(inventory_value),
        "has_overdue_receivables": has_overdue_receivables,
    }


@router.get("/sales-trend")
def sales_trend(
    days: int = 30,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> list[dict]:
    """Daily posted-invoice totals for the trailing `days` days (7/30/90
    from the dashboard's own range toggle) -- the first time-series read
    this app has ever needed off Invoice. Every day in range is present
    in the response, zero-filled, so a line chart never has to guess at
    a gap versus a real zero-sales day."""
    days = max(1, min(days, 90))
    start = date.today() - timedelta(days=days - 1)
    rows = db.execute(
        select(Invoice.invoice_date, func.coalesce(func.sum(Invoice.total), 0))
        .where(Invoice.status == "posted", Invoice.invoice_date >= start)
        .group_by(Invoice.invoice_date)
    ).all()
    by_date = {r[0]: r[1] for r in rows}
    return [
        {"date": (start + timedelta(days=i)).isoformat(), "total": str(by_date.get(start + timedelta(days=i), Decimal(0)))}
        for i in range(days)
    ]
