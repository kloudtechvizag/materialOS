"""Shared line-computation logic for Quotation and SalesOrder -- both
price + tax a line the same way; duplicating this per document type is
exactly the kind of drift B13's "this rule appears in exactly one
module" warns about.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.masters import Customer, Item
from app.models.tenant import Company
from app.services.money import round_line_tax
from app.services.pricing import ResolvedPrice, resolve_price
from app.tax.resolve import TaxBreakdown, resolve_tax


@dataclass
class PricedLine:
    item: Item
    qty: Decimal
    uom: str
    unit_price: Decimal
    price_source: str
    rate_contract_id: uuid.UUID | None
    line_subtotal: Decimal
    tax: TaxBreakdown
    line_total: Decimal


def resolve_place_of_supply(*, site_state: str | None, customer: Customer, company: Company) -> str:
    return site_state or customer.billing_state or company.state or ""


def price_line(
    db: Session,
    *,
    item: Item,
    qty: Decimal,
    uom: str,
    customer: Customer,
    company: Company,
    project_id: uuid.UUID | None,
    site_state: str | None,
    as_of: date,
) -> PricedLine:
    priced: ResolvedPrice = resolve_price(db, customer_id=customer.id, item=item, qty=qty, project_id=project_id, as_of=as_of)
    line_subtotal = round_line_tax(qty * priced.unit_price)

    place_of_supply = resolve_place_of_supply(site_state=site_state, customer=customer, company=company)
    tax = resolve_tax(
        document_date=as_of,
        place_of_supply_state=place_of_supply,
        company_state=company.state or "",
        item=item,
        taxable_value=line_subtotal,
    )

    return PricedLine(
        item=item,
        qty=qty,
        uom=uom,
        unit_price=priced.unit_price,
        price_source=priced.source,
        rate_contract_id=priced.rate_contract_id,
        line_subtotal=line_subtotal,
        tax=tax,
        line_total=line_subtotal + tax.total_tax,
    )
