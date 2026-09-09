from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.demo_request import DemoRequest
from app.schemas.demo_requests import DemoRequestCreate
from app.services.industry import PROFILE_DEFINITIONS

_KNOWN_INDUSTRY_SLUGS = {d["slug"] for d in PROFILE_DEFINITIONS}


def create_demo_request(db: Session, payload: DemoRequestCreate) -> DemoRequest:
    if payload.industry_slug is not None and payload.industry_slug not in _KNOWN_INDUSTRY_SLUGS:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown industry: {payload.industry_slug!r}", status_code=422)

    demo_request = DemoRequest(
        full_name=payload.full_name, email=payload.email, phone=payload.phone,
        company_name=payload.company_name, industry_slug=payload.industry_slug,
        message=payload.message, source_page=payload.source_page,
    )
    db.add(demo_request)
    db.flush()
    return demo_request
