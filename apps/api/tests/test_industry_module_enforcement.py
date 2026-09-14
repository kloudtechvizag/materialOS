"""Backend enforcement of industry-exclusive modules (require_module,
app/deps.py) -- the real gap fixed here: RBAC alone was never enough,
because industry-exclusive permission resources ("laboratory",
"printing") get backfilled onto every tenant's `owner` role whenever a
new one is introduced (see e.g. migration
b8c9d0e1f2a3_backfill_laboratory_permissions.py's own docstring). Before
this fix, a Printing-profile tenant's owner had `laboratory.*`
permissions and could call `/api/v1/lab/*` successfully by URL alone,
even though the UI never shows them that nav link. require_module()
closes that: on top of the normal permission check, the tenant's own
Company -> IndustryProfile.enabled_modules must actually list the
module the endpoint belongs to.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signup(slug: str, industry_slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": industry_slug,
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def test_a_printing_tenant_cannot_call_laboratory_apis_despite_having_the_rbac_permission():
    slug = f"modgate-print-{uuid.uuid4().hex[:8]}"
    token = _signup(slug, "printing_press")
    headers = {"Authorization": f"Bearer {token}"}

    # The owner role really does carry laboratory.* permissions (backfilled
    # onto every tenant) -- this proves RBAC alone would have let this
    # through before require_module existed.
    resp = client.get("/api/v1/lab/sample-types", headers=headers)
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["details"]["module"] == "laboratory"

    create_resp = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "X", "name": "X"})
    assert create_resp.status_code == 403


def test_a_laboratory_tenant_cannot_call_printing_apis_despite_having_the_rbac_permission():
    slug = f"modgate-lab-{uuid.uuid4().hex[:8]}"
    token = _signup(slug, "laboratory")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/print-machines", headers=headers)
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["details"]["module"] == "printing"


def test_the_matching_industry_tenant_is_unaffected():
    """The whole point: require_module must not become a second
    permission system that blocks legitimate access -- a printing tenant
    still fully works against its own module."""
    slug = f"modgate-ok-{uuid.uuid4().hex[:8]}"
    token = _signup(slug, "printing_press")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/print-machines", headers=headers)
    assert resp.status_code == 200, resp.text


def test_module_gate_applies_before_permission_gate_is_even_reached_for_a_user_with_no_lab_role():
    """Belt-and-braces: even a user who somehow lacked the laboratory
    permission entirely still gets a clean 403 either way -- module
    gating doesn't depend on the permission check having run first."""
    slug = f"modgate-order-{uuid.uuid4().hex[:8]}"
    token = _signup(slug, "printing_press")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "X", "name": "X"})
    assert resp.status_code == 403
