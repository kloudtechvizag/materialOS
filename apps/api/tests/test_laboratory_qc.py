"""Laboratory QC subsystem (blanks/controls/duplicates) -- the second
pass on top of the walking skeleton (ADR-021 addendum). Proves blanks/
controls compute pass/fail against a reference sample's real acceptance
range, duplicates compute a real RPD against the original result, and
-- the actual integration point -- a failed QC run genuinely blocks
authorizing results for that test until a fresh QC run passes.
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
    email = f"analyst-{slug}@example.com"
    client.post(
        "/api/v1/users", headers=owner_headers,
        json={"email": email, "full_name": "Second User", "password": "correct-horse-battery-staple", "role_names": ["owner"]},
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": email, "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def _make_test_def(headers: dict, **overrides) -> dict:
    payload = {
        "code": f"PH-{uuid.uuid4().hex[:6]}", "name": "pH", "result_type": "quantitative", "unit": "pH",
        "reference_range_low": "6.5", "reference_range_high": "8.5",
    }
    payload.update(overrides)
    return client.post("/api/v1/lab/test-definitions", headers=headers, json=payload).json()


def test_control_qc_run_passes_within_range_and_fails_outside_it():
    slug = f"labqc-control-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)

    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=headers,
        json={"test_definition_id": test_def["id"], "qc_type": "control", "name": "pH 7.00 Buffer", "expected_low": "6.90", "expected_high": "7.10"},
    )
    assert reference.status_code == 201, reference.text
    reference_id = reference.json()["id"]

    passing = client.post("/api/v1/lab/qc-runs/reference", headers=headers, json={"reference_sample_id": reference_id, "result_value": "7.02"})
    assert passing.status_code == 201, passing.text
    assert passing.json()["status"] == "pass"
    assert passing.json()["qc_type"] == "control"

    failing = client.post("/api/v1/lab/qc-runs/reference", headers=headers, json={"reference_sample_id": reference_id, "result_value": "6.50"})
    assert failing.status_code == 201
    assert failing.json()["status"] == "fail"


def test_blank_qc_run_uses_the_same_mechanism_as_control():
    slug = f"labqc-blank-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers, code=f"COND-{uuid.uuid4().hex[:6]}", name="Conductivity", unit="uS/cm", reference_range_low=None, reference_range_high=None)

    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=headers,
        json={"test_definition_id": test_def["id"], "qc_type": "blank", "name": "Reagent Blank", "expected_low": "0", "expected_high": "0.5"},
    ).json()

    passing = client.post("/api/v1/lab/qc-runs/reference", headers=headers, json={"reference_sample_id": reference["id"], "result_value": "0.1"})
    assert passing.json()["status"] == "pass"
    assert passing.json()["qc_type"] == "blank"

    failing = client.post("/api/v1/lab/qc-runs/reference", headers=headers, json={"reference_sample_id": reference["id"], "result_value": "5.0"})
    assert failing.json()["status"] == "fail"


def test_duplicate_qc_run_computes_real_rpd_and_respects_the_configured_threshold():
    slug = f"labqc-dup-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers, duplicate_rpd_limit_percent="10.00")

    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Dup Test Co", "billing_state": "Andhra Pradesh"}).json()
    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer["id"], "sample_type_id": sample_type["id"], "test_definition_ids": [test_def["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)
    client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "7.00"})

    # |7.00 - 7.20| / ((7.00+7.20)/2) * 100 = 2.82% -- within the 10% limit.
    within_limit = client.post("/api/v1/lab/qc-runs/duplicate", headers=headers, json={"source_test_order_id": test_order_id, "result_value": "7.20"})
    assert within_limit.status_code == 201, within_limit.text
    assert within_limit.json()["status"] == "pass"
    assert float(within_limit.json()["rpd_percent"]) == 2.82

    # |7.00 - 9.00| / ((7.00+9.00)/2) * 100 = 25.0% -- exceeds the 10% limit.
    exceeds_limit = client.post("/api/v1/lab/qc-runs/duplicate", headers=headers, json={"source_test_order_id": test_order_id, "result_value": "9.00"})
    assert exceeds_limit.json()["status"] == "fail"
    assert float(exceeds_limit.json()["rpd_percent"]) == 25.0


def test_duplicate_qc_run_without_a_configured_threshold_is_recorded_but_never_fails():
    slug = f"labqc-dup-nolimit-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)  # no duplicate_rpd_limit_percent set

    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "No Limit Co", "billing_state": "Andhra Pradesh"}).json()
    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer["id"], "sample_type_id": sample_type["id"], "test_definition_ids": [test_def["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=headers)
    client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "1.00"})

    # A huge RPD, but with no threshold configured this must not fabricate a failure.
    wild_dup = client.post("/api/v1/lab/qc-runs/duplicate", headers=headers, json={"source_test_order_id": test_order_id, "result_value": "50.00"})
    assert wild_dup.status_code == 201
    assert wild_dup.json()["status"] == "pass"
    assert wild_dup.json()["rpd_percent"] is not None


def test_a_failed_qc_run_blocks_authorization_until_a_passing_run_is_recorded():
    slug = f"labqc-gate-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    analyst_token = _second_user_token(owner_headers, slug)
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    test_def = _make_test_def(owner_headers)
    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=owner_headers,
        json={"test_definition_id": test_def["id"], "qc_type": "control", "name": "pH 7.00 Buffer", "expected_low": "6.90", "expected_high": "7.10"},
    ).json()

    sample_type = client.post("/api/v1/lab/sample-types", headers=owner_headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=owner_headers, json={"name": "QC Gate Co", "billing_state": "Andhra Pradesh"}).json()
    sample = client.post(
        "/api/v1/lab/samples", headers=owner_headers,
        json={"client_id": customer["id"], "sample_type_id": sample_type["id"], "test_definition_ids": [test_def["id"]]},
    ).json()
    sample_id = sample["id"]
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/samples/{sample_id}/accession", headers=owner_headers)
    client.post(f"/api/v1/lab/samples/{sample_id}/accept", headers=owner_headers)

    result = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=analyst_headers, json={"result_value": "7.00"}).json()
    client.post(f"/api/v1/lab/results/{result['id']}/validate", headers=analyst_headers)

    # A failing control QC run for this same test...
    client.post("/api/v1/lab/qc-runs/reference", headers=owner_headers, json={"reference_sample_id": reference["id"], "result_value": "6.00"})

    blocked = client.post(f"/api/v1/lab/results/{result['id']}/authorize", headers=owner_headers)
    assert blocked.status_code == 409
    assert "QC run failed" in blocked.json()["error"]["message"]

    # A fresh passing QC run for the same test clears the block.
    client.post("/api/v1/lab/qc-runs/reference", headers=owner_headers, json={"reference_sample_id": reference["id"], "result_value": "7.01"})

    authorized = client.post(f"/api/v1/lab/results/{result['id']}/authorize", headers=owner_headers)
    assert authorized.status_code == 200, authorized.text
    assert authorized.json()["status"] == "authorized"


def test_qc_reference_sample_rejects_an_invalid_qc_type():
    slug = f"labqc-badtype-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)

    resp = client.post(
        "/api/v1/lab/qc-reference-samples", headers=headers,
        json={"test_definition_id": test_def["id"], "qc_type": "duplicate", "name": "Bad Reference"},
    )
    assert resp.status_code == 400
