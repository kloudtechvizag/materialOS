import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.schemas.analytics import (
    AnalyticsOverviewOut,
    AttendanceByClassOut,
    AttendanceTrendPointOut,
    ExamPerformanceOut,
    FeeCollectionByClassOut,
    HomeworkCompletionOut,
)
from app.services.analytics import (
    get_attendance_by_class,
    get_attendance_trend,
    get_exam_performance,
    get_fee_collection_by_class,
    get_homework_completion_by_section,
    get_overview,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_module("education"))])


@router.get("/overview", response_model=AnalyticsOverviewOut)
def overview_endpoint(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))):
    return get_overview(db, tenant_id=user.tenant_id, branch_id=branch_id)


@router.get("/attendance-trend", response_model=list[AttendanceTrendPointOut])
def attendance_trend_endpoint(
    days: int = 30, branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))
):
    return get_attendance_trend(db, tenant_id=user.tenant_id, days=days, branch_id=branch_id)


@router.get("/attendance-by-class", response_model=list[AttendanceByClassOut])
def attendance_by_class_endpoint(
    days: int = 30, branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))
):
    return get_attendance_by_class(db, tenant_id=user.tenant_id, days=days, branch_id=branch_id)


@router.get("/fee-collection-by-class", response_model=list[FeeCollectionByClassOut])
def fee_collection_by_class_endpoint(
    branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))
):
    return get_fee_collection_by_class(db, tenant_id=user.tenant_id, branch_id=branch_id)


@router.get("/exam-performance", response_model=list[ExamPerformanceOut])
def exam_performance_endpoint(
    examination_id: uuid.UUID, branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))
):
    return get_exam_performance(db, tenant_id=user.tenant_id, examination_id=examination_id, branch_id=branch_id)


@router.get("/homework-completion", response_model=list[HomeworkCompletionOut])
def homework_completion_endpoint(
    branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user=Depends(require_permission("analytics.view"))
):
    return get_homework_completion_by_section(db, tenant_id=user.tenant_id, branch_id=branch_id)
