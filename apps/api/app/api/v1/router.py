from fastapi import APIRouter

from app.api.v1 import (
    auth,
    branches,
    catalog,
    collections,
    companies,
    customers,
    dashboard,
    dispatch,
    field_sales,
    fleet,
    health,
    imports,
    procurement,
    projects,
    sales,
    suppliers,
    tenants,
    users,
    warehouse_ops,
    warehouses,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(tenants.router)
api_router.include_router(companies.router)
api_router.include_router(branches.router)
api_router.include_router(warehouses.router)
api_router.include_router(users.router)
api_router.include_router(imports.router)
api_router.include_router(catalog.router)
api_router.include_router(customers.router)
api_router.include_router(projects.router)
api_router.include_router(sales.router)
api_router.include_router(dashboard.router)
api_router.include_router(fleet.router)
api_router.include_router(dispatch.router)
api_router.include_router(warehouse_ops.router)
api_router.include_router(suppliers.router)
api_router.include_router(procurement.router)
api_router.include_router(collections.router)
api_router.include_router(field_sales.router)
