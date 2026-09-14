"""Laboratory & Scientific Testing (industry #25): the real walking
skeleton of Register -> Accession -> Accept/Reject -> Result Entry ->
Validate -> Authorize -> Report, proven end-to-end over real HTTP
requests, not just service-level unit calls -- including the
segregation-of-duties rule (spec sec46) and never-overwrite report
versioning (spec sec35).
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signup(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": "laboratory",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def _second_user_token(owner_headers: dict, slug: str) -> str:
    """A second real user, also given the owner role -- used to prove
    segregation of duties (one user enters, a DIFFERENT one authorizes)
    without needing a dedicated laboratory-role catalog in this pass."""
    email = f"analyst-{slug}@example.com"
    client.post(
        "/api/v1/users", headers=owner_headers,
        json={"email": email, "full_name": "Second User", "password": "correct-horse-battery-staple", "role_names": ["owner"]},
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": email, "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def _setup_lab(headers: dict) -> dict:
    """Real catalog + a real client, via the actual endpoints."""
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    container = client.post("/api/v1/lab/containers", headers=headers, json={"code": "BOTTLE", "name": "Sterile Bottle"}).json()
    test_def = client.post(
        "/api/v1/lab/test-definitions", headers=headers,
        json={
            "code": "PH", "name": "pH", "result_type": "quantitative", "unit": "pH",
            "reference_range_low": "6.5", "reference_range_high": "8.5",
            "critical_low": "4.0", "critical_high": "10.0",
        },
    ).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "ABC Diagnostics", "billing_state": "Andhra Pradesh"}).json()
    return {"sample_type": sample_type, "container": container, "test_def": test_def, "customer": customer}


def test_full_sample_lifecycle_register_to_report():
    slug = f"lab-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    analyst_token = _second_user_token(owner_headers, slug)
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    setup = _setup_lab(owner_headers)

    register = client.post(
        "/api/v1/lab/samples", headers=owner_headers,
        json={
            "client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"],
            "container_id": setup["container"]["id"], "priority": "routine",
            "test_definition_ids": [setup["test_def"]["id"]],
        },
    )
    assert register.status_code == 201, register.text
    sample = register.json()
    assert sample["status"] == "registered"
    assert sample["sample_number"].startswith("LAB-")
    assert len(sample["test_orders"]) == 1
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]

    accessioned = client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=owner_headers)
    assert accessioned.status_code == 200
    assert accessioned.json()["status"] == "accessioned"
    assert accessioned.json()["received_datetime"] is not None

    accepted = client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=owner_headers)
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    # Analyst enters a normal, in-range result.
    result = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=analyst_headers, json={"result_value": "7.2"})
    assert result.status_code == 201, result.text
    assert result.json()["status"] == "draft"
    assert result.json()["flag"] == "normal"
    result_id = result.json()["id"]

    in_process = client.get(f"/api/v1/lab/samples/{sample_id}", headers=owner_headers).json()
    assert in_process["status"] == "in_process"

    validated = client.post(f"/api/v1/lab/results/{result_id}/validate", headers=analyst_headers)
    assert validated.status_code == 200
    assert validated.json()["status"] == "validated"

    # The owner (a different user than the analyst who entered it) authorizes.
    authorized = client.post(f"/api/v1/lab/results/{result_id}/authorize", headers=owner_headers)
    assert authorized.status_code == 200
    assert authorized.json()["status"] == "authorized"

    completed = client.get(f"/api/v1/lab/samples/{sample_id}", headers=owner_headers).json()
    assert completed["status"] == "completed"

    report = client.post(f"/api/v1/lab/samples/{sample_id}/report", headers=owner_headers)
    assert report.status_code == 201, report.text
    assert report.json()["version"] == 1
    assert report.json()["status"] == "released"
    report_number = report.json()["report_number"]
    report_id = report.json()["id"]

    reported_sample = client.get(f"/api/v1/lab/samples/{sample_id}", headers=owner_headers).json()
    assert reported_sample["status"] == "reported"

    # Superseding never overwrites the original -- it creates v2 and flips v1.
    superseded = client.post(f"/api/v1/lab/reports/{report_id}/supersede", headers=owner_headers)
    assert superseded.status_code == 201
    assert superseded.json()["version"] == 2
    assert superseded.json()["report_number"] == report_number

    all_versions = client.get(f"/api/v1/lab/samples/{sample_id}/reports", headers=owner_headers).json()
    assert len(all_versions) == 2
    v1 = next(r for r in all_versions if r["version"] == 1)
    v2 = next(r for r in all_versions if r["version"] == 2)
    assert v1["status"] == "superseded"
    assert v1["superseded_by_report_id"] == v2["id"]
    assert v2["status"] == "released"


def test_sample_rejection_requires_a_reason_and_stops_the_workflow():
    slug = f"lab-reject-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    client.post(f"/api/v1/lab/samples/{sample['id']}/accession", headers=headers)

    missing_reason = client.post(f"/api/v1/lab/samples/{sample['id']}/reject", headers=headers, json={"reason": ""})
    assert missing_reason.status_code == 400

    rejected = client.post(f"/api/v1/lab/samples/{sample['id']}/reject", headers=headers, json={"reason": "Sample leaked in transit"})
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["rejection_reason"] == "Sample leaked in transit"

    # A rejected sample cannot be accepted afterward.
    cannot_accept = client.post(f"/api/v1/lab/samples/{sample['id']}/accept", headers=headers)
    assert cannot_accept.status_code == 409


def test_cannot_enter_result_before_sample_is_accepted():
    slug = f"lab-early-result-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    test_order_id = sample["test_orders"][0]["id"]

    resp = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "7.0"})
    assert resp.status_code == 409


def test_analyst_cannot_authorize_their_own_result():
    slug = f"lab-selfauth-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)

    result = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "7.0"}).json()
    client.post(f"/api/v1/lab/results/{result['id']}/validate", headers=headers)

    self_authorize = client.post(f"/api/v1/lab/results/{result['id']}/authorize", headers=headers)
    assert self_authorize.status_code == 409
    assert "cannot also authorize" in self_authorize.json()["error"]["message"]


def test_cannot_generate_report_before_all_results_are_authorized():
    slug = f"lab-early-report-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    sample_id = sample["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)

    too_early = client.post(f"/api/v1/lab/samples/{sample_id}/report", headers=headers)
    assert too_early.status_code == 409


def test_result_flag_reflects_reference_and_critical_ranges():
    slug = f"lab-flags-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)

    # Reference range is 6.5-8.5, critical is <4.0 or >10.0.
    abnormal = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "9.5"})
    assert abnormal.json()["flag"] == "abnormal"


def test_result_flag_critical_beyond_critical_limits():
    slug = f"lab-critical-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)

    critical = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "2.0"})
    assert critical.json()["flag"] == "critical"


def test_a_tenant_without_laboratory_permission_is_forbidden():
    slug = f"lab-noperm-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    from app.db import SessionLocal, set_session_context
    from app.models.user import Permission, Role, RolePermission, User, UserRole
    from app.security import create_access_token

    db = SessionLocal()
    try:
        owner_me = client.get("/api/v1/auth/me", headers=owner_headers).json()
        tenant_id = uuid.UUID(owner_me["tenant_id"])
        set_session_context(db, tenant_id=str(tenant_id), user_id=None)
        role = Role(tenant_id=tenant_id, name="No Lab Access")
        db.add(role)
        db.flush()
        items_permission = db.query(Permission).filter(Permission.code == "items.view").one()
        db.add(RolePermission(tenant_id=tenant_id, role_id=role.id, permission_id=items_permission.id))
        user = User(tenant_id=tenant_id, email="nolab@example.com", full_name="No Lab", hashed_password="x", is_active=True)
        db.add(user)
        db.flush()
        db.add(UserRole(tenant_id=tenant_id, user_id=user.id, role_id=role.id))
        db.commit()
        token = create_access_token(user_id=user.id, tenant_id=tenant_id)
    finally:
        db.close()

    resp = client.get("/api/v1/lab/samples", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_samples_are_tenant_isolated():
    slug_a = f"lab-iso-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"lab-iso-b-{uuid.uuid4().hex[:8]}"
    token_a = _signup(slug_a)
    token_b = _signup(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    setup = _setup_lab(headers_a)
    sample = client.post(
        "/api/v1/lab/samples", headers=headers_a,
        json={"client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"], "test_definition_ids": [setup["test_def"]["id"]]},
    ).json()

    cross_tenant = client.get(f"/api/v1/lab/samples/{sample['id']}", headers=headers_b)
    assert cross_tenant.status_code == 404

    b_listing = client.get("/api/v1/lab/samples", headers=headers_b).json()
    assert b_listing == []


def test_registering_a_sample_rejects_an_invalid_priority():
    slug = f"lab-badpriority-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}
    setup = _setup_lab(headers)

    resp = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={
            "client_id": setup["customer"]["id"], "sample_type_id": setup["sample_type"]["id"],
            "priority": "asap", "test_definition_ids": [setup["test_def"]["id"]],
        },
    )
    assert resp.status_code == 400


def test_creating_a_test_definition_rejects_an_invalid_result_type():
    slug = f"lab-badresulttype-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}

    resp = client.post(
        "/api/v1/lab/test-definitions", headers=headers,
        json={"code": "BAD", "name": "Bad Test", "result_type": "numberish"},
    )
    assert resp.status_code == 400


def test_qualitative_result_is_never_auto_flagged_and_carries_no_numeric_value():
    """The flag/numeric_value machinery only applies to quantitative
    tests -- a qualitative test (e.g. a Positive/Negative microbiology
    result) must round-trip its raw text untouched, with no numeric
    parsing attempted and no flag fabricated from a comparison that
    doesn't apply to it.
    """
    slug = f"lab-qualitative-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    headers = {"Authorization": f"Bearer {owner_token}"}

    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "SWAB", "name": "Swab"}).json()
    test_def = client.post(
        "/api/v1/lab/test-definitions", headers=headers,
        json={"code": "MICRO", "name": "E. coli", "result_type": "qualitative"},
    ).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Micro Client", "billing_state": "Andhra Pradesh"}).json()

    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer["id"], "sample_type_id": sample_type["id"], "test_definition_ids": [test_def["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)

    result = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "Not Detected"})
    assert result.status_code == 201, result.text
    body = result.json()
    assert body["result_value"] == "Not Detected"
    assert body["numeric_value"] is None
    assert body["flag"] is None
