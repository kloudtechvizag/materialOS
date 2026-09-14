from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from app.deps import get_db_tenant, require_module, require_permission
from app.models.jewellery import MetalRate
from app.models.tenant import Company
from app.models.user import User
from app.schemas.jewellery import MetalRateCreate, MetalRateOut

# require_module (ADR-022) closes the same gap here it closed for
# laboratory/printing: `items.edit`/`items.view` are generic permissions
# granted broadly, so without this a non-jewellery tenant's owner could
# still call these endpoints directly by URL even with the nav item
# correctly hidden.
router = APIRouter(tags=["jewellery"], dependencies=[Depends(require_module("jewellery"))])


@router.get("/metal-rates", response_model=list[MetalRateOut])
def list_metal_rates(
    db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("items.view"))
) -> list[MetalRate]:
    return db.execute(
        select(MetalRate).order_by(MetalRate.effective_date.desc(), MetalRate.metal, MetalRate.purity)
    ).scalars().all()


@router.post("/metal-rates", response_model=MetalRateOut, status_code=201)
def create_metal_rate(
    payload: MetalRateCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("items.edit")),
) -> MetalRate:
    """One rate per metal+purity+day (upsert-by-day, not append-only) --
    a shop correcting a typo'd morning rate re-enters the same day
    rather than accumulating conflicting rows resolve_price() would
    then have to arbitrate between."""
    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    existing = db.execute(
        select(MetalRate).where(
            MetalRate.company_id == company.id, MetalRate.metal == payload.metal,
            MetalRate.purity == payload.purity, MetalRate.effective_date == payload.effective_date,
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.rate_per_gram = payload.rate_per_gram
        db.flush()
        return existing

    rate = MetalRate(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(rate)
    db.flush()
    return rate
