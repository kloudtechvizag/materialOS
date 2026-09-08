from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.db import SessionLocal
from app.errors import register_error_handlers
from app.services.billing_plans import ensure_plan_catalog
from app.services.industry import ensure_industry_profile_catalog
from app.services.permissions import ensure_permission_catalog


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        ensure_permission_catalog(db)
        ensure_industry_profile_catalog(db)
        ensure_plan_catalog(db)
        db.commit()  # all three are flush-only; this lifespan owns the commit
    finally:
        db.close()
    yield


app = FastAPI(title="MaterialOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(api_router)
