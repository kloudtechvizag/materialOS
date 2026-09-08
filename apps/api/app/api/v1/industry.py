from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.industry import IndustryProfile
from app.schemas.industry import IndustryProfileOut

router = APIRouter(prefix="/industry-profiles", tags=["industry"])


@router.get("", response_model=list[IndustryProfileOut])
def list_industry_profiles(db: Session = Depends(get_db)) -> list[IndustryProfile]:
    """Public reference data (no tenant context, no permission check) --
    needed pre-auth by the signup wizard as well as by the authenticated
    Settings > Industry Configuration page. Not tenant-scoped, so RLS
    doesn't apply (see models/industry.py)."""
    return (
        db.execute(select(IndustryProfile).where(IndustryProfile.is_active).order_by(IndustryProfile.name))
        .scalars()
        .all()
    )
