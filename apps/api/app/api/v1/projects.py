import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.projects import Project, Site
from app.models.sales import Invoice, InvoiceItem
from app.models.user import User
from app.schemas.projects import ProjectCreate, ProjectOut, ProjectProfitability, SiteCreate, SiteOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list[Project]:
    return db.execute(select(Project).order_by(Project.created_at.desc())).scalars().all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.create")),
) -> Project:
    data = payload.model_dump()
    sites_data = data.pop("sites")
    project = Project(tenant_id=user.tenant_id, **data)
    db.add(project)
    db.flush()
    for site_data in sites_data:
        db.add(Site(tenant_id=user.tenant_id, project_id=project.id, **site_data))
    db.flush()
    db.refresh(project)
    return project


@router.post("/{project_id}/sites", response_model=SiteOut, status_code=201)
def create_site(
    project_id: uuid.UUID,
    payload: SiteCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.create")),
) -> Site:
    """Adding a site to a project that already exists -- ProjectCreate's
    nested `sites` only covers a site created in the same request as its
    project. Quick Add Site (and any other post-hoc site addition) needs
    this instead.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise AppError(ErrorCode.NOT_FOUND, "Project not found.", status_code=404)

    site = Site(tenant_id=user.tenant_id, project_id=project_id, **payload.model_dump())
    db.add(site)
    db.flush()
    db.refresh(site)
    return site


@router.get("/{project_id}/profitability", response_model=ProjectProfitability)
def project_profitability(
    project_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> dict:
    """Part C's "project profitability" -- computed on read from invoiced
    lines, not a maintained running total: it's a handful of rows per
    project at this stage, and a stored aggregate would just be another
    place for drift to hide.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise AppError(ErrorCode.NOT_FOUND, "Project not found.", status_code=404)

    rows = db.execute(
        select(InvoiceItem.qty, InvoiceItem.rate, InvoiceItem.cost)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.project_id == project_id, Invoice.status == "posted")
    ).all()

    revenue = sum((qty * rate for qty, rate, _ in rows), Decimal("0"))
    cost = sum((qty * cost for qty, _, cost in rows), Decimal("0"))
    profit = revenue - cost
    margin = (profit / revenue * 100) if revenue else Decimal("0")

    return {
        "project_id": project_id,
        "revenue": str(revenue),
        "cost": str(cost),
        "profit": str(profit),
        "margin_percent": str(margin.quantize(Decimal("0.01"))),
    }
