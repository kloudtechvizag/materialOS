"""Laboratory specifications (sixth pass): a real pass/fail mechanism
layered on top of the walking skeleton's flat reference_range/critical
columns, for what those cannot express -- a client's own tighter limit,
or a different limit per sample type sharing the same test (spec
sec24's own "Concrete M30 vs M40" example). Proves resolution
precedence (client+sample_type > client-only > sample_type-only >
tenant-wide default), that no specification configured means no
verdict rather than a fabricated one, target+/-tolerance evaluation,
text-criteria evaluation, and the null-safe duplicate-scope rejection.
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


def _make_test_def(headers: dict, **overrides) -> dict:
    payload = {"code": f"CS-{uuid.uuid4().hex[:6]}", "name": "Compressive Strength", "result_type": "quantitative", "unit": "MPa"}
    payload.update(overrides)
    return client.post("/api/v1/lab/test-definitions", headers=headers, json=payload).json()


def _make_sample_with_result(headers: dict, test_def_id: str, sample_type_id: str, customer_id: str, result_value: str) -> dict:
    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer_id, "sample_type_id": sample_type_id, "test_definition_ids": [test_def_id]},
    ).json()
    client.post(f"/api/v1/lab/samples/{sample['id']}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample['id']}/accept", headers=headers)
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": result_value})
    detail = client.get(f"/api/v1/lab/samples/{sample['id']}", headers=headers).json()
    return detail["results"][0]


def test_a_result_with_no_specification_configured_gets_no_verdict():
    slug = f"labspec-none-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "CONCRETE", "name": "Concrete"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "No Spec Co", "billing_state": "Andhra Pradesh"}).json()

    result = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "35.0")
    assert result["specification_id"] is None
    assert result["specification_result"] is None


def test_a_tenant_wide_default_specification_evaluates_pass_and_fail():
    slug = f"labspec-default-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "CONCRETE", "name": "Concrete"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Default Spec Co", "billing_state": "Andhra Pradesh"}).json()

    spec = client.post(
        "/api/v1/lab/specifications", headers=headers,
        json={"test_definition_id": test_def["id"], "name": "Default minimum 30 MPa", "criteria_type": "range", "min_value": "30.0"},
    )
    assert spec.status_code == 201, spec.text
    assert spec.json()["client_name"] is None
    assert spec.json()["sample_type_name"] is None

    passing = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "35.0")
    assert passing["specification_result"] == "pass"
    assert passing["specification_id"] == spec.json()["id"]

    failing = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "25.0")
    assert failing["specification_result"] == "fail"


def test_sample_type_specific_specification_overrides_the_default_concrete_m30_vs_m40():
    """The spec's own example: two sample types (grades) sharing one
    test, each with its own minimum."""
    slug = f"labspec-grade-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    m30 = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "M30", "name": "Concrete M30"}).json()
    m40 = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "M40", "name": "Concrete M40"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Grade Co", "billing_state": "Andhra Pradesh"}).json()

    client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "sample_type_id": m30["id"], "name": "M30 min", "criteria_type": "range", "min_value": "30.0"})
    client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "sample_type_id": m40["id"], "name": "M40 min", "criteria_type": "range", "min_value": "40.0"})

    # 35 MPa passes M30's spec but fails M40's -- same test, different sample type.
    m30_result = _make_sample_with_result(headers, test_def["id"], m30["id"], customer["id"], "35.0")
    assert m30_result["specification_result"] == "pass"

    m40_result = _make_sample_with_result(headers, test_def["id"], m40["id"], customer["id"], "35.0")
    assert m40_result["specification_result"] == "fail"


def test_precedence_client_and_sample_type_beats_client_only_beats_sample_type_only_beats_default():
    slug = f"labspec-precedence-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "CONCRETE", "name": "Concrete"}).json()
    other_sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "CONCRETE2", "name": "Concrete Other"}).json()
    vip_customer = client.post("/api/v1/customers", headers=headers, json={"name": "VIP Client", "billing_state": "Andhra Pradesh"}).json()

    # Default: min 10 (very loose). Sample-type-only: min 20. Client-only: min 30.
    # Client+sample_type (most specific): min 50 (strictest).
    client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "name": "Default", "criteria_type": "range", "min_value": "10.0"})
    client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "sample_type_id": sample_type["id"], "name": "By sample type", "criteria_type": "range", "min_value": "20.0"})
    client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "client_id": vip_customer["id"], "name": "By client", "criteria_type": "range", "min_value": "30.0"})
    most_specific = client.post(
        "/api/v1/lab/specifications", headers=headers,
        json={"test_definition_id": test_def["id"], "client_id": vip_customer["id"], "sample_type_id": sample_type["id"], "name": "By client+type", "criteria_type": "range", "min_value": "50.0"},
    ).json()

    # 40 MPa: fails the most-specific (client+sample_type, min 50) spec, even
    # though it would pass every less-specific one -- proves precedence, not just "a" spec applying.
    result = _make_sample_with_result(headers, test_def["id"], sample_type["id"], vip_customer["id"], "40.0")
    assert result["specification_id"] == most_specific["id"]
    assert result["specification_result"] == "fail"

    # A different sample type for the same VIP client: no client+sample_type match, falls to client-only (min 30).
    result_other_type = _make_sample_with_result(headers, test_def["id"], other_sample_type["id"], vip_customer["id"], "35.0")
    assert result_other_type["specification_result"] == "pass"  # client-only min 30, 35 passes


def test_target_and_tolerance_evaluates_a_range_without_explicit_min_max():
    slug = f"labspec-tolerance-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers, name="pH", unit="pH")
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Tolerance Co", "billing_state": "Andhra Pradesh"}).json()

    client.post(
        "/api/v1/lab/specifications", headers=headers,
        json={"test_definition_id": test_def["id"], "name": "pH 7.0 +/- 0.5", "criteria_type": "range", "target_value": "7.0", "tolerance": "0.5"},
    )

    within = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "7.3")
    assert within["specification_result"] == "pass"

    outside = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "7.8")
    assert outside["specification_result"] == "fail"


def test_text_criteria_specification_for_a_qualitative_result():
    slug = f"labspec-text-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers, code=f"COLI-{uuid.uuid4().hex[:6]}", name="Coliform", result_type="qualitative", unit=None)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Text Spec Co", "billing_state": "Andhra Pradesh"}).json()

    client.post(
        "/api/v1/lab/specifications", headers=headers,
        json={"test_definition_id": test_def["id"], "name": "Must be Absent", "criteria_type": "text", "text_value": "Absent"},
    )

    passing = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "Absent")
    assert passing["specification_result"] == "pass"

    failing = _make_sample_with_result(headers, test_def["id"], sample_type["id"], customer["id"], "Present")
    assert failing["specification_result"] == "fail"


def test_creating_a_duplicate_scope_specification_is_rejected_including_the_null_safe_default_case():
    slug = f"labspec-dup-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)

    first = client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "name": "Default 1", "criteria_type": "range", "min_value": "10.0"})
    assert first.status_code == 201

    # A second "default" (client_id=None, sample_type_id=None) specification for the
    # same test -- this is exactly the case a naive DB UNIQUE constraint would miss,
    # since Postgres treats NULL as distinct from NULL.
    duplicate = client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "name": "Default 2", "criteria_type": "range", "min_value": "20.0"})
    assert duplicate.status_code == 409, duplicate.text


def test_text_criteria_without_a_text_value_is_rejected():
    slug = f"labspec-badtext-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)

    resp = client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "name": "Bad", "criteria_type": "text"})
    assert resp.status_code == 400


def test_range_criteria_with_no_bounds_at_all_is_rejected():
    slug = f"labspec-noboundS-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)

    resp = client.post("/api/v1/lab/specifications", headers=headers, json={"test_definition_id": test_def["id"], "name": "Bad", "criteria_type": "range"})
    assert resp.status_code == 400


def test_specification_rbac_denial_and_tenant_isolation():
    slug_a = f"labspec-rbac-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"labspec-rbac-b-{uuid.uuid4().hex[:8]}"
    token_a = _signup(slug_a)
    token_b = _signup(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    test_def_a = _make_test_def(headers_a)
    spec_a = client.post("/api/v1/lab/specifications", headers=headers_a, json={"test_definition_id": test_def_a["id"], "name": "A's spec", "criteria_type": "range", "min_value": "1.0"}).json()

    listing_b = client.get("/api/v1/lab/specifications", headers=headers_b).json()
    assert all(s["id"] != spec_a["id"] for s in listing_b)

    no_auth = client.get("/api/v1/lab/specifications")
    assert no_auth.status_code == 401
