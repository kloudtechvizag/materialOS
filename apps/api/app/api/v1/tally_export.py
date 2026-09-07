from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.tenant import Company
from app.services.tally_export import export_period_to_tally_xml

router = APIRouter(prefix="/tally-export", tags=["tally-export"])


@router.get("")
def export_tally(
    from_date: date, to_date: date, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.export")),
) -> Response:
    company = db.execute(select(Company)).scalars().first()
    xml = export_period_to_tally_xml(db, company_id=company.id, from_date=from_date, to_date=to_date)
    filename = f"materialos-tally-export-{from_date}-{to_date}.xml"
    return Response(content=xml, media_type="application/xml", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
