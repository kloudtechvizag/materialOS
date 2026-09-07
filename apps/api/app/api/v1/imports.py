import uuid

from fastapi import APIRouter, Depends, File, Form, Header, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.importing import ImportBatch, ImportBatchRow
from app.models.user import User
from app.schemas.importing import (
    ColumnMappingRequest,
    ImportBatchOut,
    ImportCommitResponse,
    ImportPreviewResponse,
)
from app.services.idempotency import run_idempotent
from app.services.importing import pipeline
from app.storage import read_file, save_file

router = APIRouter(prefix="/imports", tags=["imports"])


@router.get("", response_model=list[ImportBatchOut])
def list_batches(
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.view")),
) -> list[ImportBatch]:
    return db.execute(select(ImportBatch).order_by(ImportBatch.created_at.desc())).scalars().all()


@router.get("/{batch_id}", response_model=ImportBatchOut)
def get_batch(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.view")),
) -> ImportBatch:
    return _get_batch_or_404(db, batch_id)


def _get_batch_or_404(db: Session, batch_id: uuid.UUID) -> ImportBatch:
    batch = db.get(ImportBatch, batch_id)
    if batch is None:
        raise AppError(ErrorCode.NOT_FOUND, "Import batch not found.", status_code=404)
    return batch


@router.post("/upload", response_model=ImportBatchOut, status_code=201)
async def upload(
    company_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("imports.create")),
) -> ImportBatch:
    content = await file.read()
    source_type = pipeline.detect_format(file.filename, content)
    storage_path = save_file(tenant_id=user.tenant_id, category="imports", file_name=file.filename, content=content)

    batch = ImportBatch(
        tenant_id=user.tenant_id,
        company_id=company_id,
        source_type=source_type,
        status="format_detected",
        file_name=file.filename,
        storage_path=storage_path,
        uploaded_by_user_id=user.id,
    )
    db.add(batch)
    db.flush()

    if source_type == "tally_xml":
        pipeline.stage_tally_xml(db, batch, content)

    return batch


@router.get("/{batch_id}/columns")
def get_columns(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.view")),
) -> dict:
    batch = _get_batch_or_404(db, batch_id)
    if batch.source_type != "busy_csv":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Column mapping only applies to CSV imports.")
    content = read_file(batch.storage_path)
    columns, guessed_mapping = pipeline.sniff_csv_columns(content)
    return {"columns": columns, "guessed_mapping": guessed_mapping}


@router.post("/{batch_id}/map", response_model=ImportBatchOut)
def map_columns(
    batch_id: uuid.UUID,
    payload: ColumnMappingRequest,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.create")),
) -> ImportBatch:
    batch = _get_batch_or_404(db, batch_id)
    content = read_file(batch.storage_path)
    pipeline.apply_csv_column_mapping(
        db, batch, content, row_type=payload.row_type, mapping=payload.mapping
    )
    return batch


@router.post("/{batch_id}/validate", response_model=ImportBatchOut)
def validate(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.create")),
) -> ImportBatch:
    batch = _get_batch_or_404(db, batch_id)
    pipeline.validate_batch(db, batch)
    return batch


@router.post("/{batch_id}/preview", response_model=ImportPreviewResponse)
def preview(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("imports.create")),
) -> dict:
    batch = _get_batch_or_404(db, batch_id)
    result = pipeline.build_preview(db, batch)
    return {"batch": batch, **result}


@router.post("/{batch_id}/commit", response_model=ImportCommitResponse)
def commit(
    batch_id: uuid.UUID,
    default_warehouse_id: uuid.UUID | None = None,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("imports.create")),
) -> dict:
    batch = _get_batch_or_404(db, batch_id)

    def _do_commit() -> tuple[int, dict]:
        result = pipeline.commit_batch(
            db,
            batch,
            company_id=batch.company_id,
            default_warehouse_id=default_warehouse_id,
            user_id=user.id,
        )
        return 200, {
            "batch": ImportBatchOut.model_validate(batch).model_dump(mode="json"),
            **result,
        }

    _status, body = run_idempotent(
        db,
        tenant_id=user.tenant_id,
        idempotency_key=idempotency_key,
        request_path=f"/imports/{batch_id}/commit",
        request_body={"batch_id": str(batch_id), "default_warehouse_id": str(default_warehouse_id)},
        compute=_do_commit,
    )
    return body
