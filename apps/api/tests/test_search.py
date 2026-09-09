"""Global search (Ctrl+K command palette backend) -- must respect the
caller's real per-resource permissions, not just tenant isolation.
"""
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.models.masters import Customer, Item, Supplier
from app.models.user import Permission, Role, RolePermission, User, UserRole

client = TestClient(app)


def _signed_up_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_search_finds_customer_and_scoped_to_tenant():
    slug_a = f"srch-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"srch-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    create_resp = client.post("/api/v1/customers", headers=headers_a, json={"name": "Zephyr Constructions Ltd"})
    assert create_resp.status_code == 201, create_resp.text

    found = client.get("/api/v1/search?q=Zephyr", headers=headers_a)
    assert found.status_code == 200
    titles = [c["title"] for c in found.json()["customers"]]
    assert "Zephyr Constructions Ltd" in titles

    # Tenant B's owner (real signup, real permissions) must not see tenant A's customer.
    not_found = client.get("/api/v1/search?q=Zephyr", headers=headers_b)
    assert not_found.json()["customers"] == []


def test_search_empty_query_returns_empty_results():
    slug = f"srch-empty-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    resp = client.get("/api/v1/search?q=", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["customers"] == [] and body["items"] == [] and body["invoices"] == []


def test_search_hides_category_without_permission(db, tenant_ctx):
    """A user whose role grants only items.view should see item matches
    but never customer matches, even if a matching customer exists --
    this is the whole point of gating search by real permission checks."""
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]

    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Restricted Customer Co")
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="SRCH-1", name="Restricted Item Widget",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("10"), standard_cost=Decimal("5"),
    )
    db.add_all([customer, item])
    db.flush()

    items_only_role = Role(tenant_id=tenant.id, name="Items Only")
    db.add(items_only_role)
    db.flush()
    items_permission = db.query(Permission).filter(Permission.code == "items.view").one()
    db.add(RolePermission(tenant_id=tenant.id, role_id=items_only_role.id, permission_id=items_permission.id))

    restricted_user = User(
        tenant_id=tenant.id, email="items-only@example.com", full_name="Items Only User",
        hashed_password="not-a-real-hash", is_active=True,
    )
    db.add(restricted_user)
    db.flush()
    db.add(UserRole(tenant_id=tenant.id, user_id=restricted_user.id, role_id=items_only_role.id))
    db.commit()

    from app.security import create_access_token

    token = create_access_token(user_id=restricted_user.id, tenant_id=tenant.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/search?q=Restricted", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "Restricted Item Widget"
    assert body["customers"] == []
