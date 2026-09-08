import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.backup import Backup
from app.models.tenant import Company
from app.models.user import User
from app.schemas.backup import BackupOut, RestoreRequest
from app.services import backup as backup_service
from app.services.backup_tasks import execute_backup_task

router = APIRouter(prefix="/backups", tags=["operations"])


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


@router.get("", response_model=list[BackupOut])
def list_backups(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("backup.view"))
) -> list[Backup]:
    return db.execute(select(Backup).order_by(Backup.created_at.desc()).limit(100)).scalars().all()


@router.get("/{backup_id}", response_model=BackupOut)
def get_backup(
    backup_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("backup.view"))
) -> Backup:
    from app.errors import AppError, ErrorCode

    backup = db.get(Backup, backup_id)
    if backup is None:
        raise AppError(ErrorCode.NOT_FOUND, "Backup not found.", status_code=404)
    return backup


@router.post("/run", response_model=BackupOut, status_code=201)
def run_backup_now(
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("backup.create")),
) -> Backup:
    """sec15: "Run Backup Now" -- creates a trackable `pending` row
    immediately (fast), hands the actual dump/encrypt/store work to a
    background task (execute_backup_task) so this request doesn't
    block on however long that takes."""
    company = _default_company(db, user.tenant_id)
    backup = backup_service.create_pending_backup(db, tenant_id=user.tenant_id, company_id=company.id, user_id=user.id)
    db.flush()
    execute_backup_task.delay(backup_id=str(backup.id), tenant_id=str(user.tenant_id))
    return backup


@router.post("/{backup_id}/verify", response_model=BackupOut)
def verify_backup(
    backup_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("backup.view")),
) -> Backup:
    """sec9: a backup isn't "successful" merely because a file was
    created -- decrypts it, recomputes the checksum, and confirms
    every table's row count matches what was recorded at backup time.
    Synchronous (unlike creation): verification is a read-only check
    on data that already exists, not a slow multi-table dump."""
    return backup_service.verify_backup(db, backup_id=backup_id)


@router.post("/{backup_id}/restore", response_model=BackupOut)
def restore_backup(
    backup_id: uuid.UUID, payload: RestoreRequest, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("backup.restore")),
) -> Backup:
    """sec10: requires explicit confirm=True (the UI's confirmation
    dialog result) -- a separate, higher-privilege permission
    (backup.restore, not backup.create) than triggering a backup,
    per sec52's "do not give restore/delete permissions to normal
    users." Synchronous: sec10's warning dialog implies the caller is
    watching for the result, and restore (delete + re-insert this
    tenant's own rows, FK-ordered) is not slow enough to need
    backgrounding the way a fresh multi-table dump is."""
    return backup_service.restore_backup(db, tenant_id=user.tenant_id, backup_id=backup_id, user_id=user.id, confirm=payload.confirm)
