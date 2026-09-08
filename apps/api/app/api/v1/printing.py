import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.printing import PrintJob, PrintJobArtwork, PrintMachine
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.printing import (
    CompleteJobRequest,
    JobProfitabilityOut,
    PrintJobArtworkOut,
    PrintJobCreate,
    PrintJobOut,
    PrintJobStatusUpdate,
    PrintJobUpdate,
    PrintMachineCreate,
    PrintMachineOut,
    PrintMachineStatusUpdate,
)
from app.services import printing as printing_service
from app.storage import save_file

router = APIRouter(tags=["printing"])


def _default_company_and_branch(db: Session, tenant_id: uuid.UUID) -> tuple[Company, Branch]:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    return company, branch


def _get_job(db: Session, job_id: uuid.UUID) -> PrintJob:
    job = db.get(PrintJob, job_id)
    if job is None:
        raise AppError(ErrorCode.NOT_FOUND, "Print job not found.", status_code=404)
    return job


# ---------------------------------------------------------------- Machines

@router.get("/print-machines", response_model=list[PrintMachineOut])
def list_print_machines(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view"))
) -> list[PrintMachine]:
    return db.execute(select(PrintMachine).where(PrintMachine.is_active.is_(True)).order_by(PrintMachine.name)).scalars().all()


@router.post("/print-machines", response_model=PrintMachineOut, status_code=201)
def create_print_machine(
    payload: PrintMachineCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("printing.create")),
) -> PrintMachine:
    company, _ = _default_company_and_branch(db, user.tenant_id)
    machine = PrintMachine(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(machine)
    db.flush()
    return machine


@router.patch("/print-machines/{machine_id}/status", response_model=PrintMachineOut)
def update_machine_status(
    machine_id: uuid.UUID, payload: PrintMachineStatusUpdate, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("printing.edit")),
) -> PrintMachine:
    machine = db.get(PrintMachine, machine_id)
    if machine is None:
        raise AppError(ErrorCode.NOT_FOUND, "Machine not found.", status_code=404)
    machine.status = payload.status
    db.flush()
    return machine


# ------------------------------------------------------------- Production board

@router.get("/printing-board")
def get_printing_board(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view"))
) -> dict:
    """sec22: one column per production-board status. Grouped server-side
    (same shape as GET /dispatch-board) rather than the frontend
    filtering one big list five times."""
    from app.models.printing import JOB_STATUSES

    jobs = db.execute(select(PrintJob).where(PrintJob.status != "cancelled").order_by(PrintJob.due_date.asc().nulls_last())).scalars().all()
    board: dict[str, list] = {status: [] for status in JOB_STATUSES if status not in ("invoiced", "cancelled")}
    for job in jobs:
        if job.status in board:
            board[job.status].append(PrintJobOut.model_validate(job))
    return board


# ---------------------------------------------------------------- Jobs

@router.get("/print-jobs", response_model=list[PrintJobOut])
def list_print_jobs(
    status: str | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view")),
) -> list[PrintJob]:
    stmt = select(PrintJob).order_by(PrintJob.created_at.desc())
    if status:
        stmt = stmt.where(PrintJob.status == status)
    return db.execute(stmt).scalars().all()


@router.get("/print-jobs/{job_id}", response_model=PrintJobOut)
def get_print_job(
    job_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view")),
) -> PrintJob:
    return _get_job(db, job_id)


@router.get("/print-jobs/{job_id}/profitability", response_model=JobProfitabilityOut)
def get_job_profitability(
    job_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view")),
) -> printing_service.JobProfitability:
    job = _get_job(db, job_id)
    return printing_service.job_profitability(job)


@router.post("/print-jobs", response_model=PrintJobOut, status_code=201)
def create_print_job_endpoint(
    payload: PrintJobCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("printing.create")),
) -> PrintJob:
    company, branch = _default_company_and_branch(db, user.tenant_id)
    return printing_service.create_print_job(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, **payload.model_dump()
    )


@router.patch("/print-jobs/{job_id}", response_model=PrintJobOut)
def update_print_job(
    job_id: uuid.UUID, payload: PrintJobUpdate, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("printing.edit")),
) -> PrintJob:
    job = _get_job(db, job_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.flush()
    return job


@router.patch("/print-jobs/{job_id}/status", response_model=PrintJobOut)
def update_print_job_status(
    job_id: uuid.UUID, payload: PrintJobStatusUpdate, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("printing.edit")),
) -> PrintJob:
    return printing_service.update_job_status(db, print_job_id=job_id, new_status=payload.status)


@router.post("/print-jobs/{job_id}/rework", response_model=PrintJobOut, status_code=201)
def create_rework_job_endpoint(
    job_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("printing.create")),
) -> PrintJob:
    return printing_service.create_rework_job(db, tenant_id=user.tenant_id, original_job_id=job_id)


@router.post("/print-jobs/{job_id}/complete", response_model=PrintJobOut)
def complete_print_job(
    job_id: uuid.UUID, payload: CompleteJobRequest, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("printing.edit")),
) -> PrintJob:
    return printing_service.complete_job_and_invoice(
        db, tenant_id=user.tenant_id, print_job_id=job_id, user_id=user.id,
        payment_amount=payload.payment_amount, payment_mode=payload.payment_mode,
    )


# ---------------------------------------------------------------- Artwork

@router.get("/print-jobs/{job_id}/artwork", response_model=list[PrintJobArtworkOut])
def list_artwork(
    job_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("printing.view")),
) -> list[PrintJobArtwork]:
    return db.execute(
        select(PrintJobArtwork).where(PrintJobArtwork.print_job_id == job_id).order_by(PrintJobArtwork.version_number.desc())
    ).scalars().all()


@router.post("/print-jobs/{job_id}/artwork", response_model=PrintJobArtworkOut, status_code=201)
async def upload_artwork_endpoint(
    job_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("printing.create")),
) -> PrintJobArtwork:
    content = await file.read()
    storage_path = save_file(tenant_id=user.tenant_id, category="print_artwork", file_name=file.filename, content=content)
    return printing_service.upload_artwork(
        db, tenant_id=user.tenant_id, print_job_id=job_id, file_name=file.filename,
        storage_path=storage_path, uploaded_by_user_id=user.id,
    )


@router.post("/print-jobs/{job_id}/artwork/{artwork_id}/approve", response_model=PrintJobArtworkOut)
def approve_artwork_endpoint(
    job_id: uuid.UUID, artwork_id: uuid.UUID, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("printing.approve")),
) -> PrintJobArtwork:
    return printing_service.approve_artwork(db, artwork_id=artwork_id, approved_by_user_id=user.id)
