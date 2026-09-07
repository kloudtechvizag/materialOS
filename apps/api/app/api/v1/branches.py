from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.tenant import Branch
from app.schemas.tenant import BranchCreate, BranchOut

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("branches.view")),
) -> list[Branch]:
    return db.execute(select(Branch).order_by(Branch.created_at)).scalars().all()


@router.post("", response_model=BranchOut, status_code=201)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db_tenant),
    user=Depends(require_permission("branches.create")),
) -> Branch:
    branch = Branch(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(branch)
    db.flush()
    return branch
