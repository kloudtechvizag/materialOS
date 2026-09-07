"""Part C: rate contracts are a first-class entity that override all
other pricing while active and within their quantity ceiling; §19's
price rule (customer + product + quantity + location + date + project)
resolves in one place so no screen re-implements the precedence order.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.masters import Item
from app.models.pricing import CustomerItemPrice, RateContract


@dataclass
class ResolvedPrice:
    unit_price: Decimal
    source: str  # "rate_contract" | "customer_price" | "standard_price"
    rate_contract_id: uuid.UUID | None = None


def resolve_price(
    db: Session,
    *,
    customer_id: uuid.UUID,
    item: Item,
    qty: Decimal,
    project_id: uuid.UUID | None,
    as_of: date,
) -> ResolvedPrice:
    contract_stmt = (
        select(RateContract)
        .where(
            RateContract.customer_id == customer_id,
            RateContract.item_id == item.id,
            RateContract.valid_from <= as_of,
            RateContract.valid_to >= as_of,
        )
        .order_by(RateContract.project_id.is_(None))  # project-specific contract wins over a customer-wide one
    )
    for contract in db.execute(contract_stmt).scalars().all():
        if contract.project_id is not None and contract.project_id != project_id:
            continue
        if contract.qty_consumed + qty > contract.qty_ceiling:
            continue
        return ResolvedPrice(unit_price=contract.rate, source="rate_contract", rate_contract_id=contract.id)

    customer_price = db.execute(
        select(CustomerItemPrice).where(
            CustomerItemPrice.customer_id == customer_id, CustomerItemPrice.item_id == item.id
        )
    ).scalar_one_or_none()
    if customer_price is not None:
        return ResolvedPrice(unit_price=customer_price.price, source="customer_price")

    return ResolvedPrice(unit_price=item.standard_price, source="standard_price")


def consume_rate_contract(db: Session, rate_contract_id: uuid.UUID, qty: Decimal) -> None:
    contract = db.get(RateContract, rate_contract_id)
    if contract is not None:
        contract.qty_consumed += qty
