import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.sales import Invoice
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.pos import WalkInSaleCreate, WalkInSaleOut, WalkInSaleReceiptOut
from app.services.numbering import get_current_financial_year
from app.services.pos import WalkInSaleLine, create_walk_in_sale

router = APIRouter(prefix="/pos", tags=["pos"])


def _default_company_and_branch(db: Session, tenant_id: uuid.UUID) -> tuple[Company, Branch]:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    return company, branch


@router.post("/sales", response_model=WalkInSaleReceiptOut, status_code=201)
def create_walk_in_sale_endpoint(
    payload: WalkInSaleCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("pos.create")),
) -> WalkInSaleReceiptOut:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)

    sale = create_walk_in_sale(
        db,
        tenant_id=user.tenant_id,
        company_id=company.id,
        branch_id=branch.id,
        warehouse_id=payload.warehouse_id,
        financial_year_id=fy.id,
        user_id=user.id,
        customer_id=payload.customer_id,
        lines=[WalkInSaleLine(item_id=i.item_id, qty=i.qty, uom=i.uom) for i in payload.items],
        cash_amount=payload.cash_amount,
        upi_amount=payload.upi_amount,
        card_amount=payload.card_amount,
        tendered_amount=payload.tendered_amount,
    )
    invoice = db.get(Invoice, sale.invoice_id)
    return WalkInSaleReceiptOut(
        sale=WalkInSaleOut.model_validate(sale),
        invoice_number=invoice.number,
        subtotal=invoice.subtotal,
        tax_total=invoice.tax_total,
        total=invoice.total,
    )
