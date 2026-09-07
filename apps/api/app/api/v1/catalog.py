import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.catalog import Category
from app.models.masters import Item
from app.models.user import User
from app.schemas.catalog import CategoryCreate, CategoryOut, ItemCreate, ItemOut, ItemUpdate

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("items.view"))
) -> list[Category]:
    return db.execute(select(Category).order_by(Category.name)).scalars().all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("items.create")),
) -> Category:
    from app.models.tenant import Company

    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    category = Category(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(category)
    db.flush()
    return category


@router.get("/items", response_model=list[ItemOut])
def list_items(
    q: str | None = None,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("items.view")),
) -> list[Item]:
    stmt = select(Item).where(Item.is_active.is_(True)).order_by(Item.name).limit(200)
    if q:
        stmt = stmt.where(Item.name.ilike(f"%{q}%"))
    return db.execute(stmt).scalars().all()


@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("items.view")),
) -> Item:
    from app.errors import AppError, ErrorCode

    item = db.get(Item, item_id)
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "Item not found.", status_code=404)
    return item


@router.post("/items", response_model=ItemOut, status_code=201)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("items.create")),
) -> Item:
    from app.models.tenant import Company

    company = db.execute(select(Company).where(Company.tenant_id == user.tenant_id)).scalars().first()
    item = Item(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(item)
    db.flush()
    return item


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("items.edit")),
) -> Item:
    from app.errors import AppError, ErrorCode

    item = db.get(Item, item_id)
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "Item not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.flush()
    return item
