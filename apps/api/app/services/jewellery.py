import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Category

# Matches exactly the attribute keys services/pricing.py::compute_jewellery_price
# reads off Item.attributes -- a category with this schema is what makes
# the generic DynamicAttributesFieldset (ItemsPage.tsx) render the right
# inputs for a jewellery item, with zero new frontend code (ADR-003/
# ADR-010's existing mechanism, not a new one).
JEWELLERY_CATEGORY_NAME = "Jewellery Items"
JEWELLERY_PARAMETER_SCHEMA = [
    {"name": "metal", "unit": None},
    {"name": "purity", "unit": None},
    {"name": "net_weight_g", "unit": "g"},
    {"name": "making_charge_type", "unit": "percentage or flat"},
    {"name": "making_charge_value", "unit": None},
    {"name": "wastage_percentage", "unit": "%"},
    {"name": "stone_charge", "unit": "INR"},
]


def ensure_jewellery_category(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> None:
    """Idempotent, same pattern as ensure_permission_catalog/ensure_
    industry_profile_catalog -- called whenever a company's industry
    profile becomes "jewellery" (signup or a later profile switch), so
    there's always at least one category shaped to actually drive the
    weight_making_wastage pricing formula, not just a profile label with
    no way to enter the data it needs."""
    existing = db.execute(
        select(Category).where(Category.company_id == company_id, Category.name == JEWELLERY_CATEGORY_NAME)
    ).scalar_one_or_none()
    if existing is not None:
        return
    db.add(Category(tenant_id=tenant_id, company_id=company_id, name=JEWELLERY_CATEGORY_NAME, parameter_schema=JEWELLERY_PARAMETER_SCHEMA))
    db.flush()
