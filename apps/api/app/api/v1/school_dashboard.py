import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_module
from app.models.user import User
from app.schemas.school_dashboard import SchoolDashboardSummaryOut
from app.services.school_dashboard import get_school_dashboard_summary

router = APIRouter(prefix="/school-dashboard", tags=["school-dashboard"], dependencies=[Depends(require_module("education"))])


@router.get("/summary", response_model=SchoolDashboardSummaryOut)
def summary_endpoint(
    branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)
) -> dict:
    """No single `require_permission` gate -- see services/
    school_dashboard.py's own docstring: each section is independently
    included only when the calling user really holds that domain's
    permission, so a user with none of these permissions gets a
    genuinely (not fake-) near-empty response rather than a 403 for a
    page every real school staff role can at least partially see."""
    return get_school_dashboard_summary(db, tenant_id=user.tenant_id, user_id=user.id, branch_id=branch_id)
