from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant
from app.models.crm import Lead
from app.models.masters import Customer, Item, Supplier
from app.models.procurement import PurchaseOrder
from app.models.sales import Invoice, Quotation, SalesOrder
from app.models.user import Permission, RolePermission, User, UserRole
from app.schemas.search import SearchResultItem, SearchResults

router = APIRouter(tags=["search"])

LIMIT_PER_CATEGORY = 5


def _has_permission(db: Session, user: User, code: str) -> bool:
    stmt = (
        select(RolePermission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(UserRole.user_id == user.id)
        .where(Permission.code == code)
    )
    return db.execute(stmt).first() is not None


@router.get("/search", response_model=SearchResults)
def global_search(
    q: str, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user),
) -> SearchResults:
    """Ctrl+K command palette's backend: one round trip, grouped by
    entity type, each category only included if the caller actually
    has that resource's *.view permission -- a warehouse-only user
    should not see invoice numbers just because they typed a number
    into the search box. Capped at 5 results/category, matching a
    palette's real estate, not a full search-results page."""
    results = SearchResults()
    if not q or not q.strip():
        return results
    like = f"%{q.strip()}%"

    if _has_permission(db, user, "leads.view"):
        leads = db.execute(
            select(Lead).where(Lead.name.ilike(like) | Lead.company_name.ilike(like)).order_by(Lead.created_at.desc()).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.leads = [
            SearchResultItem(id=lead.id, title=lead.company_name or lead.name, subtitle=lead.status, href="/leads")
            for lead in leads
        ]

    if _has_permission(db, user, "customers.view"):
        customers = db.execute(
            select(Customer).where(Customer.name.ilike(like)).order_by(Customer.name).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.customers = [
            SearchResultItem(id=c.id, title=c.name, subtitle=c.billing_state, href=f"/customers/{c.id}")
            for c in customers
        ]

    if _has_permission(db, user, "suppliers.view"):
        suppliers = db.execute(
            select(Supplier).where(Supplier.name.ilike(like)).order_by(Supplier.name).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.suppliers = [
            SearchResultItem(id=s.id, title=s.name, subtitle=s.billing_state, href=f"/suppliers/{s.id}")
            for s in suppliers
        ]

    if _has_permission(db, user, "items.view"):
        items = db.execute(
            select(Item).where(Item.name.ilike(like) | Item.sku.ilike(like)).order_by(Item.name).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.items = [
            SearchResultItem(id=i.id, title=i.name, subtitle=i.sku, href="/items")
            for i in items
        ]

    if _has_permission(db, user, "customers.view"):
        quotations = db.execute(
            select(Quotation).where(Quotation.number.ilike(like)).order_by(Quotation.quote_date.desc()).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.quotations = _with_customer_names(db, quotations, "/quotations")

        sales_orders = db.execute(
            select(SalesOrder).where(SalesOrder.number.ilike(like)).order_by(SalesOrder.order_date.desc()).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.sales_orders = _with_customer_names(db, sales_orders, "/sales-orders")

        invoices = db.execute(
            select(Invoice).where(Invoice.number.ilike(like)).order_by(Invoice.invoice_date.desc()).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        results.invoices = _with_customer_names(db, invoices, "/invoices")

    if _has_permission(db, user, "suppliers.view"):
        purchase_orders = db.execute(
            select(PurchaseOrder).where(PurchaseOrder.number.ilike(like)).order_by(PurchaseOrder.po_date.desc()).limit(LIMIT_PER_CATEGORY)
        ).scalars().all()
        supplier_ids = {po.supplier_id for po in purchase_orders}
        suppliers_by_id = {
            s.id: s.name for s in db.execute(select(Supplier).where(Supplier.id.in_(supplier_ids))).scalars().all()
        } if supplier_ids else {}
        results.purchase_orders = [
            SearchResultItem(id=po.id, title=po.number, subtitle=suppliers_by_id.get(po.supplier_id), href=f"/purchase-orders/{po.id}")
            for po in purchase_orders
        ]

    return results


def _with_customer_names(db: Session, docs: list, href_prefix: str) -> list[SearchResultItem]:
    customer_ids = {d.customer_id for d in docs}
    customers_by_id = {
        c.id: c.name for c in db.execute(select(Customer).where(Customer.id.in_(customer_ids))).scalars().all()
    } if customer_ids else {}
    return [
        SearchResultItem(id=d.id, title=d.number, subtitle=customers_by_id.get(d.customer_id), href=f"{href_prefix}/{d.id}")
        for d in docs
    ]
