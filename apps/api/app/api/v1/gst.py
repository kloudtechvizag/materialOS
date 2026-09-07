from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.schemas.gst import Gstr1ExtractOut, Gstr3bExtractOut
from app.services.gst_reports import gstr1_extract, gstr3b_extract

router = APIRouter(prefix="/gst", tags=["gst"])


@router.get("/gstr1", response_model=Gstr1ExtractOut)
def get_gstr1(month: int, year: int, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))):
    return gstr1_extract(db, month=month, year=year)


@router.get("/gstr3b", response_model=Gstr3bExtractOut)
def get_gstr3b(month: int, year: int, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))):
    return gstr3b_extract(db, month=month, year=year)
