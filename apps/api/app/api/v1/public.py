"""Genuinely unauthenticated endpoints for the public marketing site --
no Depends(get_db_tenant), no permission check, no bearer token. Kept in
its own router/module (rather than folded into an existing file) so
"no auth here" stays obvious at a glance.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.demo_requests import DemoRequestCreate, DemoRequestOut
from app.services.demo_requests import create_demo_request

router = APIRouter(prefix="/public", tags=["public"])


@router.post("/demo-requests", response_model=DemoRequestOut, status_code=201)
def submit_demo_request(payload: DemoRequestCreate, db: Session = Depends(get_db)) -> DemoRequestOut:
    demo_request = create_demo_request(db, payload)
    db.commit()
    return demo_request
