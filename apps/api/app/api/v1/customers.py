import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.masters import Customer
from app.models.sales import Invoice, Quotation, SalesOrder
from app.models.user import User
from app.schemas.customer import Customer360, CustomerCreate, CustomerOut
from app.services.credit import compute_outstanding

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> list[Customer]:
    stmt = select(Customer).where(Customer.is_active.is_(True)).order_by(Customer.name).limit(200)
    if q:
        stmt = stmt.where(Customer.name.ilike(f"%{q}%"))
    return db.execute(stmt).scalars().all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.create")),
) -> Customer:
    from app.models.tenant import Company

    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    customer = Customer(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(customer)
    db.flush()
    return customer


@router.get("/{customer_id}/360", response_model=Customer360)
def customer_360(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> dict:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise AppError(ErrorCode.NOT_FOUND, "Customer not found.", status_code=404)

    outstanding = compute_outstanding(db, customer_id)
    available_credit = customer.credit_limit - outstanding if customer.credit_limit > 0 else None

    open_quotations = db.execute(
        select(func.count()).select_from(Quotation).where(
            Quotation.customer_id == customer_id, Quotation.status.in_(["draft", "sent"])
        )
    ).scalar_one()
    open_sales_orders = db.execute(
        select(func.count()).select_from(SalesOrder).where(
            SalesOrder.customer_id == customer_id, SalesOrder.status.notin_(["invoiced", "cancelled"])
        )
    ).scalar_one()
    posted_invoices = db.execute(
        select(func.count()).select_from(Invoice).where(
            Invoice.customer_id == customer_id, Invoice.status == "posted"
        )
    ).scalar_one()

    return {
        "customer": customer,
        "outstanding": outstanding,
        "available_credit": available_credit if available_credit is not None else 0,
        "open_quotations": open_quotations,
        "open_sales_orders": open_sales_orders,
        "posted_invoices": posted_invoices,
    }
