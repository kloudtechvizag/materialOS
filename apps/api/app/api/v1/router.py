from fastapi import APIRouter

from app.api.v1 import auth, branches, companies, health, imports, tenants, users, warehouses

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(tenants.router)
api_router.include_router(companies.router)
api_router.include_router(branches.router)
api_router.include_router(warehouses.router)
api_router.include_router(users.router)
api_router.include_router(imports.router)
