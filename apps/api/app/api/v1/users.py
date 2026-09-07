from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.user import Role, User, UserRole
from app.schemas.user import UserCreate, UserOut
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("users.view")),
) -> list[User]:
    return db.execute(select(User).order_by(User.created_at)).scalars().all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db_tenant),
    current_user: User = Depends(require_permission("users.create")),
) -> User:
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "A user with this email already exists.", status_code=409)

    user = User(
        tenant_id=current_user.tenant_id,
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    if payload.role_names:
        roles = db.execute(select(Role).where(Role.name.in_(payload.role_names))).scalars().all()
        for role in roles:
            db.add(
                UserRole(
                    tenant_id=current_user.tenant_id,
                    user_id=user.id,
                    role_id=role.id,
                    branch_id=payload.branch_id,
                )
            )

    return user
