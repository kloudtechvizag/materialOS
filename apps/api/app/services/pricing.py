"""Part C: rate contracts are a first-class entity that override all
other pricing while active and within their quantity ceiling; §19's
price rule (customer + product + quantity + location + date + project)
resolves in one place so no screen re-implements the precedence order.

Jewellery's "weight_making_wastage" pricing_strategy (services/
industry.py) used to be pure metadata -- this module never read it, so
a Jewellery tenant priced items exactly like every other flat-rate
business, silently contradicting the profile's own declared strategy.
resolve_price() now checks it as a real, lower-precedence-than-
negotiated-price step: a rate contract or customer-specific price still
wins if one exists (a jeweller can still cut a deal for a big
customer), but the *default* price for a jewellery item with weight/
metal data is now genuinely computed from the day's metal rate, not a
static standard_price nobody bothered to keep in sync with market
rates that move daily.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.industry import IndustryProfile
from app.models.jewellery import MetalRate
from app.models.masters import Item
from app.models.pricing import CustomerItemPrice, RateContract
from app.models.tenant import Company


@dataclass
class ResolvedPrice:
    unit_price: Decimal
    source: str  # "rate_contract" | "customer_price" | "weight_making_wastage" | "standard_price"
    rate_contract_id: uuid.UUID | None = None


def _latest_metal_rate(db: Session, *, company_id: uuid.UUID, metal: str, purity: str, as_of: date) -> Decimal | None:
    return db.execute(
        select(MetalRate.rate_per_gram)
        .where(
            MetalRate.company_id == company_id, MetalRate.metal == metal, MetalRate.purity == purity,
            MetalRate.effective_date <= as_of,
        )
        .order_by(MetalRate.effective_date.desc())
        .limit(1)
    ).scalar_one_or_none()


def compute_jewellery_price(db: Session, *, item: Item, company_id: uuid.UUID, as_of: date) -> Decimal | None:
    """metal_value (net weight x today's rate for that metal+purity) +
    making charges (flat or a % of metal_value) + wastage (a % of
    metal_value) + a flat stone/diamond charge. Returns None -- never
    raises -- when the item lacks the weight/metal attributes or no
    rate has been entered yet for that metal+purity, so callers can
    fall back to standard_price rather than block a sale on missing
    day-rate data entry.
    """
    attrs = item.attributes or {}
    metal = attrs.get("metal")
    net_weight_g = attrs.get("net_weight_g")
    if not metal or net_weight_g is None:
        return None

    purity = str(attrs.get("purity", ""))
    rate_per_gram = _latest_metal_rate(db, company_id=company_id, metal=metal, purity=purity, as_of=as_of)
    if rate_per_gram is None:
        return None

    metal_value = Decimal(str(net_weight_g)) * rate_per_gram

    making_type = attrs.get("making_charge_type", "percentage")
    making_value = Decimal(str(attrs.get("making_charge_value", 0)))
    making_charge = (metal_value * making_value / 100) if making_type == "percentage" else making_value

    wastage_pct = Decimal(str(attrs.get("wastage_percentage", 0)))
    wastage_value = metal_value * wastage_pct / 100

    stone_charge = Decimal(str(attrs.get("stone_charge", 0)))

    return metal_value + making_charge + wastage_value + stone_charge


def resolve_price(
    db: Session,
    *,
    customer_id: uuid.UUID,
    item: Item,
    qty: Decimal,
    project_id: uuid.UUID | None,
    as_of: date,
    company: Company | None = None,
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

    if company is not None and company.industry_profile_id is not None:
        profile = db.get(IndustryProfile, company.industry_profile_id)
        if profile is not None and profile.pricing_strategy == "weight_making_wastage":
            jewellery_price = compute_jewellery_price(db, item=item, company_id=company.id, as_of=as_of)
            if jewellery_price is not None:
                return ResolvedPrice(unit_price=jewellery_price, source="weight_making_wastage")

    return ResolvedPrice(unit_price=item.standard_price, source="standard_price")


def consume_rate_contract(db: Session, rate_contract_id: uuid.UUID, qty: Decimal) -> None:
    contract = db.get(RateContract, rate_contract_id)
    if contract is not None:
        contract.qty_consumed += qty
