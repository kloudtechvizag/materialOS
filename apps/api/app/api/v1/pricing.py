from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.billing_plans import Plan, PlanFeature, PlanLimit
from app.schemas.billing_plans import AddonOfferingOut, FeatureOut, PlanCompareOut, PlanOut
from app.services.billing_plans import compare_plans, ensure_plan_catalog, get_plan_by_slug, list_addon_offerings, list_features, list_plans

router = APIRouter(prefix="/pricing", tags=["pricing"])


def _public_db(db: Session = Depends(get_db)) -> Session:
    """Plans/features are a platform catalog with no RLS (see
    models/billing_plans.py) -- public like GET /industry-profiles,
    and self-seeding for the same reason that endpoint is (see its own
    docstring): nothing guarantees main.py's lifespan ran first."""
    ensure_plan_catalog(db)
    db.commit()
    return db


def _plan_out(db: Session, plan: Plan) -> PlanOut:
    feature_codes = db.execute(
        select(PlanFeature).where(PlanFeature.plan_id == plan.id, PlanFeature.is_enabled == True)  # noqa: E712
    ).scalars().all()
    from app.models.billing_plans import Feature
    codes = [f.code for f in db.execute(select(Feature).where(Feature.id.in_([pf.feature_id for pf in feature_codes]))).scalars().all()] if feature_codes else []

    limits = db.execute(select(PlanLimit).where(PlanLimit.plan_id == plan.id)).scalars().all()
    return PlanOut(
        id=plan.id, slug=plan.slug, version=plan.version, name=plan.name, description=plan.description,
        tier_order=plan.tier_order, is_public=plan.is_public, is_default_signup_plan=plan.is_default_signup_plan,
        currency=plan.currency, monthly_price=plan.monthly_price, yearly_price=plan.yearly_price,
        trial_days=plan.trial_days, features=codes, limits={pl.limit_key: pl.limit_value for pl in limits},
    )


@router.get("/plans", response_model=list[PlanOut])
def get_plans(include_enterprise: bool = True, db: Session = Depends(_public_db)) -> list[PlanOut]:
    plans = list_plans(db, public_only=True)
    if include_enterprise:
        enterprise = get_plan_by_slug(db, "enterprise")
        if enterprise:
            plans = plans + [enterprise]
    return [_plan_out(db, p) for p in plans]


@router.get("/features", response_model=list[FeatureOut])
def get_features(db: Session = Depends(_public_db)) -> list[FeatureOut]:
    return list_features(db)


@router.get("/compare", response_model=PlanCompareOut)
def get_compare(db: Session = Depends(_public_db)) -> PlanCompareOut:
    return compare_plans(db)


@router.get("/addons", response_model=list[AddonOfferingOut])
def get_addons(db: Session = Depends(_public_db)) -> list[AddonOfferingOut]:
    addons = list_addon_offerings(db)
    from app.models.billing_plans import Feature
    feature_by_id = {f.id: f.code for f in db.execute(select(Feature)).scalars().all()}
    return [
        AddonOfferingOut(
            id=a.id, code=a.code, name=a.name, description=a.description, category=a.category,
            feature_code=feature_by_id.get(a.feature_id) if a.feature_id else None,
            limit_key=a.limit_key, limit_delta=a.limit_delta, monthly_price=a.monthly_price, yearly_price=a.yearly_price,
        )
        for a in addons
    ]
