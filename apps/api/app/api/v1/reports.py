from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.search import _has_permission
from app.deps import get_current_user, get_db_tenant
from app.errors import AppError, ErrorCode
from app.models.user import User
from app.schemas.reports import ReportDatasetInfo, ReportResult
from app.services.reports import DATASETS, get_dataset, list_datasets, run_report

router = APIRouter(tags=["reports"])


@router.get("/reports/datasets", response_model=list[ReportDatasetInfo])
def list_report_datasets(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[ReportDatasetInfo]:
    """Only datasets the caller's role can actually view -- same
    permission-filtering discipline as the command palette (search.py)."""
    return [info for info in list_datasets() if _has_permission(db, user, DATASETS[info.key].permission)]


@router.get("/reports/run", response_model=ReportResult)
def run_report_endpoint(
    dataset: str,
    group_by: str,
    metric: str,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(get_current_user),
) -> ReportResult:
    ds = get_dataset(dataset)
    if not _has_permission(db, user, ds.permission):
        raise AppError(ErrorCode.FORBIDDEN, "You don't have permission to view this report.", status_code=403, details={"permission": ds.permission})
    return run_report(db, tenant_id=user.tenant_id, dataset_key=dataset, group_by=group_by, metric=metric)
