import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.masters import Customer, Item
from app.models.sales import Quotation, QuotationItem
from app.models.tenant import Company
from app.services.money import round_invoice_total
from app.services.numbering import next_document_number
from app.services.sales_common import price_line


def create_quotation(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    customer_id: uuid.UUID,
    project_id: uuid.UUID | None,
    site_id: uuid.UUID | None,
    site_state: str | None,
    valid_until: date | None,
    lines: list[dict],
) -> Quotation:
    company = db.get(Company, company_id)
    customer = db.get(Customer, customer_id)
    today = date.today()

    number = next_document_number(
        db,
        company_id=company_id,
        branch_id=branch_id,
        financial_year_id=financial_year_id,
        doc_type="QT",
        default_prefix="QT",
    )

    quotation = Quotation(
        tenant_id=tenant_id,
        number=number,
        company_id=company_id,
        branch_id=branch_id,
        customer_id=customer_id,
        project_id=project_id,
        site_id=site_id,
        status="draft",
        quote_date=today,
        valid_until=valid_until,
    )
    db.add(quotation)
    db.flush()

    subtotal = tax_total = total_cost = Decimal("0")
    for line in lines:
        item = db.get(Item, line["item_id"])
        priced = price_line(
            db,
            item=item,
            qty=Decimal(str(line["qty"])),
            uom=line.get("uom") or item.base_uom,
            customer=customer,
            company=company,
            project_id=project_id,
            site_state=site_state,
            as_of=today,
        )
        db.add(
            QuotationItem(
                tenant_id=tenant_id,
                quotation_id=quotation.id,
                item_id=item.id,
                qty=priced.qty,
                uom=priced.uom,
                rate=priced.unit_price,
                cost=item.standard_cost,
                gst_rate=item.gst_rate,
                line_subtotal=priced.line_subtotal,
                line_tax=priced.tax.total_tax,
                line_total=priced.line_total,
            )
        )
        subtotal += priced.line_subtotal
        tax_total += priced.tax.total_tax
        total_cost += priced.qty * item.standard_cost

    rounded_total, _round_off = round_invoice_total(subtotal + tax_total)
    quotation.subtotal = subtotal
    quotation.tax_total = tax_total
    quotation.total = rounded_total
    quotation.total_cost = total_cost
    db.flush()
    return quotation
