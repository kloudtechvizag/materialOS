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
    # The desktop app (ADR-012) does not load from localhost:5173 -- its
    # webview serves the bundled frontend from a platform-specific
    # origin (Tauri v2: https://tauri.localhost on Windows/Linux,
    # tauri://localhost on macOS), and any browser hitting a self-hosted
    # backend directly is on some localhost/127.0.0.1 port too. Without
    # this, only the plain GETs (no preflight required) ever worked --
    # a POST like /auth/login sends a CORS preflight OPTIONS first,
    # which the exact-match allow_origins list above rejects with 400
    # before the request body is ever read. Caught live: "Test
    # connection" (GET /health/live, no preflight) succeeded while
    # signup/login (POST, preflighted) failed with what looked like a
    # network error but was actually this.
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https?://tauri\.localhost|tauri://localhost)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(api_router)
