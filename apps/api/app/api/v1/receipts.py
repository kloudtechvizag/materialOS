import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.tenant import Company
from app.models.user import User
from app.schemas.receipts import ReceiptData, ReceiptSettingsOut, ReceiptSettingsUpdate
from app.services import receipt_templates as receipts_service

router = APIRouter(tags=["receipts"])


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


@router.get("/receipt-settings", response_model=ReceiptSettingsOut)
def get_receipt_settings(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("receipts.view"))):
    company = _default_company(db, user.tenant_id)
    return receipts_service.ensure_receipt_settings(db, tenant_id=user.tenant_id, company_id=company.id)


@router.put("/receipt-settings", response_model=ReceiptSettingsOut)
def update_receipt_settings(payload: ReceiptSettingsUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("receipts.manage"))):
    company = _default_company(db, user.tenant_id)
    return receipts_service.update_receipt_settings(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/receipts/{document_type}/{document_id}", response_model=ReceiptData)
def get_receipt(document_type: str, document_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("receipts.view"))) -> ReceiptData:
    return receipts_service.get_receipt_data(db, tenant_id=user.tenant_id, document_type=document_type, document_id=document_id)
