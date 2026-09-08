from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.industry import IndustryProfile
from app.schemas.industry import IndustryProfileOut
from app.services.industry import ensure_industry_profile_catalog

router = APIRouter(prefix="/industry-profiles", tags=["industry"])


@router.get("", response_model=list[IndustryProfileOut])
def list_industry_profiles(db: Session = Depends(get_db)) -> list[IndustryProfile]:
    """Public reference data (no tenant context, no permission check) --
    needed pre-auth by the signup wizard as well as by the authenticated
    Settings > Industry Configuration page. Not tenant-scoped, so RLS
    doesn't apply (see models/industry.py).

    Self-seeding rather than trusting main.py's lifespan to have run
    first (it doesn't, reliably -- see ensure_industry_profile_catalog's
    docstring): this is the one endpoint reachable with zero other state
    required, so it's the one place that must not assume anything else
    ran before it. Committed explicitly since `get_db` sessions don't
    auto-commit and the seed function is flush-only by design."""
    ensure_industry_profile_catalog(db)
    db.commit()
    return (
        db.execute(select(IndustryProfile).where(IndustryProfile.is_active).order_by(IndustryProfile.name))
        .scalars()
        .all()
    )
