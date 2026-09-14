"""Laboratory worksheets (batch testing) -- the third pass on top of the
walking skeleton and QC subsystem (ADR-021 addendum). Proves a
worksheet groups test orders for one test definition, that it must be
populated before starting and fully resulted before completing, and --
the actual integration point -- that a QC run recorded *against a
worksheet* gates authorization for that worksheet's own results without
affecting results outside it (real per-batch QC scoping, sec67), while
results never put on any worksheet keep the older test-definition-wide
QC fallback behavior.
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


def _make_sample_with_order(headers: dict, test_def_id: str, sample_type_id: str, customer_id: str) -> dict:
    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer_id, "sample_type_id": sample_type_id, "test_definition_ids": [test_def_id]},
    ).json()
    client.post(f"/api/v1/lab/samples/{sample['id']}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample['id']}/accept", headers=headers)
    return sample


def test_worksheet_groups_test_orders_for_one_test_definition_and_rejects_mismatched_ones():
    slug = f"labws-basic-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    other_test_def = _make_test_def(headers, code=f"COND-{uuid.uuid4().hex[:6]}", name="Conductivity")
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Worksheet Co", "billing_state": "Andhra Pradesh"}).json()

    worksheet = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]})
    assert worksheet.status_code == 201, worksheet.text
    worksheet_id = worksheet.json()["id"]
    assert worksheet.json()["status"] == "open"
    assert worksheet.json()["worksheet_number"].startswith("WS-")

    sample = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    test_order_id = sample["test_orders"][0]["id"]

    added = client.post(f"/api/v1/lab/worksheets/{worksheet_id}/test-orders", headers=headers, json={"test_order_id": test_order_id})
    assert added.status_code == 201, added.text
    assert len(added.json()["test_orders"]) == 1
    assert added.json()["test_orders"][0]["id"] == test_order_id

    mismatched_sample = _make_sample_with_order(headers, other_test_def["id"], sample_type["id"], customer["id"])
    mismatched_order_id = mismatched_sample["test_orders"][0]["id"]
    rejected = client.post(f"/api/v1/lab/worksheets/{worksheet_id}/test-orders", headers=headers, json={"test_order_id": mismatched_order_id})
    assert rejected.status_code == 422, rejected.text


def test_a_test_order_cannot_be_on_two_worksheets_at_once():
    slug = f"labws-dup-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Dup WS Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    test_order_id = sample["test_orders"][0]["id"]

    ws1 = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()
    ws2 = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()

    ok = client.post(f"/api/v1/lab/worksheets/{ws1['id']}/test-orders", headers=headers, json={"test_order_id": test_order_id})
    assert ok.status_code == 201

    conflict = client.post(f"/api/v1/lab/worksheets/{ws2['id']}/test-orders", headers=headers, json={"test_order_id": test_order_id})
    assert conflict.status_code == 409, conflict.text


def test_worksheet_cannot_start_empty_and_cannot_complete_with_unresulted_orders():
    slug = f"labws-lifecycle-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Lifecycle Co", "billing_state": "Andhra Pradesh"}).json()

    worksheet = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()

    empty_start = client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/start", headers=headers)
    assert empty_start.status_code == 409, empty_start.text

    sample = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    test_order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/test-orders", headers=headers, json={"test_order_id": test_order_id})

    started = client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/start", headers=headers)
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"

    incomplete = client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/complete", headers=headers)
    assert incomplete.status_code == 409, incomplete.text

    client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "7.00"})

    completed = client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/complete", headers=headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None

    reopen_attempt = client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/start", headers=headers)
    assert reopen_attempt.status_code == 409


def test_removing_a_test_order_from_a_worksheet_frees_it_for_another_worksheet():
    slug = f"labws-remove-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Remove Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    test_order_id = sample["test_orders"][0]["id"]

    ws1 = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()
    client.post(f"/api/v1/lab/worksheets/{ws1['id']}/test-orders", headers=headers, json={"test_order_id": test_order_id})

    removed = client.delete(f"/api/v1/lab/worksheets/{ws1['id']}/test-orders/{test_order_id}", headers=headers)
    assert removed.status_code == 200, removed.text
    assert removed.json()["test_orders"] == []

    ws2 = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()
    re_added = client.post(f"/api/v1/lab/worksheets/{ws2['id']}/test-orders", headers=headers, json={"test_order_id": test_order_id})
    assert re_added.status_code == 201


def test_unassigned_test_orders_endpoint_excludes_already_assigned_ones():
    slug = f"labws-unassigned-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Unassigned Co", "billing_state": "Andhra Pradesh"}).json()

    sample_a = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    sample_b = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    order_a = sample_a["test_orders"][0]["id"]
    order_b = sample_b["test_orders"][0]["id"]

    before = client.get(f"/api/v1/lab/test-orders/unassigned?test_definition_id={test_def['id']}", headers=headers).json()
    before_ids = {o["id"] for o in before}
    assert {order_a, order_b} <= before_ids

    worksheet = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()
    client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/test-orders", headers=headers, json={"test_order_id": order_a})

    after = client.get(f"/api/v1/lab/test-orders/unassigned?test_definition_id={test_def['id']}", headers=headers).json()
    after_ids = {o["id"] for o in after}
    assert order_a not in after_ids
    assert order_b in after_ids


def test_worksheet_scoped_qc_gates_only_that_worksheets_results():
    """The key integration test: a failing QC run recorded against
    worksheet A blocks authorizing results that came from worksheet A,
    but does NOT block a result on worksheet B for the same test
    definition -- real per-batch scoping, not the coarser test-wide
    fallback."""
    slug = f"labws-qcgate-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    analyst_token = _second_user_token(owner_headers, slug)
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    test_def = _make_test_def(owner_headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=owner_headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=owner_headers, json={"name": "QC Scope Co", "billing_state": "Andhra Pradesh"}).json()
    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=owner_headers,
        json={"test_definition_id": test_def["id"], "qc_type": "control", "name": "pH 7.00 Buffer", "expected_low": "6.90", "expected_high": "7.10"},
    ).json()

    # Worksheet A: gets a failing QC run.
    ws_a = client.post("/api/v1/lab/worksheets", headers=owner_headers, json={"test_definition_id": test_def["id"]}).json()
    sample_a = _make_sample_with_order(owner_headers, test_def["id"], sample_type["id"], customer["id"])
    order_a = sample_a["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/worksheets/{ws_a['id']}/test-orders", headers=owner_headers, json={"test_order_id": order_a})
    result_a = client.post(f"/api/v1/lab/test-orders/{order_a}/result", headers=analyst_headers, json={"result_value": "7.00"}).json()
    client.post(f"/api/v1/lab/results/{result_a['id']}/validate", headers=analyst_headers)

    # Worksheet B: gets a passing QC run, for the same test definition.
    ws_b = client.post("/api/v1/lab/worksheets", headers=owner_headers, json={"test_definition_id": test_def["id"]}).json()
    sample_b = _make_sample_with_order(owner_headers, test_def["id"], sample_type["id"], customer["id"])
    order_b = sample_b["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/worksheets/{ws_b['id']}/test-orders", headers=owner_headers, json={"test_order_id": order_b})
    result_b = client.post(f"/api/v1/lab/test-orders/{order_b}/result", headers=analyst_headers, json={"result_value": "7.01"}).json()
    client.post(f"/api/v1/lab/results/{result_b['id']}/validate", headers=analyst_headers)

    fail_run = client.post(
        "/api/v1/lab/qc-runs/reference", headers=owner_headers,
        json={"reference_sample_id": reference["id"], "result_value": "6.00", "worksheet_id": ws_a["id"]},
    )
    assert fail_run.status_code == 201
    assert fail_run.json()["status"] == "fail"
    assert fail_run.json()["worksheet_id"] == ws_a["id"]

    pass_run = client.post(
        "/api/v1/lab/qc-runs/reference", headers=owner_headers,
        json={"reference_sample_id": reference["id"], "result_value": "7.02", "worksheet_id": ws_b["id"]},
    )
    assert pass_run.status_code == 201
    assert pass_run.json()["status"] == "pass"

    # Worksheet A's result: blocked by worksheet A's own failing QC run.
    blocked = client.post(f"/api/v1/lab/results/{result_a['id']}/authorize", headers=owner_headers)
    assert blocked.status_code == 409, blocked.text
    assert "QC run failed" in blocked.json()["error"]["message"]

    # Worksheet B's result: NOT affected by worksheet A's failure -- its own worksheet's QC passed.
    authorized_b = client.post(f"/api/v1/lab/results/{result_b['id']}/authorize", headers=owner_headers)
    assert authorized_b.status_code == 200, authorized_b.text
    assert authorized_b.json()["status"] == "authorized"

    # A fresh passing run on worksheet A clears its block.
    client.post(
        "/api/v1/lab/qc-runs/reference", headers=owner_headers,
        json={"reference_sample_id": reference["id"], "result_value": "7.00", "worksheet_id": ws_a["id"]},
    )
    authorized_a = client.post(f"/api/v1/lab/results/{result_a['id']}/authorize", headers=owner_headers)
    assert authorized_a.status_code == 200, authorized_a.text


def test_a_result_never_put_on_a_worksheet_still_uses_the_test_wide_qc_fallback():
    """Backward compatibility: the pre-worksheet QC behavior (most
    recent run for the test definition, regardless of worksheet) must
    keep working for test orders that were never added to a
    worksheet."""
    slug = f"labws-fallback-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    analyst_token = _second_user_token(owner_headers, slug)
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    test_def = _make_test_def(owner_headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=owner_headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=owner_headers, json={"name": "Fallback Co", "billing_state": "Andhra Pradesh"}).json()
    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=owner_headers,
        json={"test_definition_id": test_def["id"], "qc_type": "control", "name": "pH 7.00 Buffer", "expected_low": "6.90", "expected_high": "7.10"},
    ).json()

    sample = _make_sample_with_order(owner_headers, test_def["id"], sample_type["id"], customer["id"])
    order_id = sample["test_orders"][0]["id"]
    result = client.post(f"/api/v1/lab/test-orders/{order_id}/result", headers=analyst_headers, json={"result_value": "7.00"}).json()
    client.post(f"/api/v1/lab/results/{result['id']}/validate", headers=analyst_headers)

    standalone_fail = client.post(
        "/api/v1/lab/qc-runs/reference", headers=owner_headers, json={"reference_sample_id": reference["id"], "result_value": "6.00"},
    )
    assert standalone_fail.json()["worksheet_id"] is None

    blocked = client.post(f"/api/v1/lab/results/{result['id']}/authorize", headers=owner_headers)
    assert blocked.status_code == 409


def test_qc_run_cannot_be_attached_to_a_completed_worksheet():
    slug = f"labws-locked-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Locked Co", "billing_state": "Andhra Pradesh"}).json()
    reference = client.post(
        "/api/v1/lab/qc-reference-samples", headers=headers,
        json={"test_definition_id": test_def["id"], "qc_type": "control", "name": "pH 7.00 Buffer", "expected_low": "6.90", "expected_high": "7.10"},
    ).json()

    worksheet = client.post("/api/v1/lab/worksheets", headers=headers, json={"test_definition_id": test_def["id"]}).json()
    sample = _make_sample_with_order(headers, test_def["id"], sample_type["id"], customer["id"])
    order_id = sample["test_orders"][0]["id"]
    client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/test-orders", headers=headers, json={"test_order_id": order_id})
    client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/start", headers=headers)
    client.post(f"/api/v1/lab/test-orders/{order_id}/result", headers=headers, json={"result_value": "7.00"})
    client.post(f"/api/v1/lab/worksheets/{worksheet['id']}/complete", headers=headers)

    locked = client.post(
        "/api/v1/lab/qc-runs/reference", headers=headers,
        json={"reference_sample_id": reference["id"], "result_value": "7.00", "worksheet_id": worksheet["id"]},
    )
    assert locked.status_code == 409, locked.text


def test_worksheet_and_test_order_rbac_denial_and_tenant_isolation():
    slug_a = f"labws-rbac-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"labws-rbac-b-{uuid.uuid4().hex[:8]}"
    token_a = _signup(slug_a)
    token_b = _signup(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    test_def_a = _make_test_def(headers_a)
    worksheet_a = client.post("/api/v1/lab/worksheets", headers=headers_a, json={"test_definition_id": test_def_a["id"]}).json()

    cross_tenant = client.get(f"/api/v1/lab/worksheets/{worksheet_a['id']}", headers=headers_b)
    assert cross_tenant.status_code == 404

    no_auth = client.post("/api/v1/lab/worksheets", json={"test_definition_id": test_def_a["id"]})
    assert no_auth.status_code == 401
